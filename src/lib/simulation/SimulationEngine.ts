import type { Graph } from "./GraphParser";
import {
  COMPONENT_REGISTRY,
  isClientType,
  isLoadBalancerType,
} from "./ComponentRegistry";
import { distributeLoad } from "./LoadBalancer";

export interface NodeMetrics {
  incoming: number;
  processed: number;
  dropped: number;
  /** Number of replicas for this node (defaults to 1) */
  replicas: number;
  /** Incoming RPS divided across replicas (incoming / replicas) */
  perReplicaIncoming: number;
  /** Effective max capacity after replica scaling */
  effectiveCapacity: number;
}

/**
 * Resolves the total effective capacity of a node by multiplying
 * its per-instance maxCapacity by its replica count.
 *
 * @returns Effective capacity in RPS, or Infinity for uncapped nodes.
 */
export function resolveEffectiveCapacity(
  maxCapacityRaw: unknown,
  replicasRaw: unknown
): number {
  const perInstance = Number(maxCapacityRaw) || Infinity;
  const replicas = Math.max(1, Math.floor(Number(replicasRaw) || 1));

  if (!isFinite(perInstance)) return Infinity;
  return perInstance * replicas;
}

export function computeSimulationFrame(
  graph: Graph,
  topologicalOrder: string[],
  globalRps: number
): Record<string, NodeMetrics> {
  const metrics: Record<string, NodeMetrics> = {};

  // Initialize metrics for all nodes
  for (const nodeId of graph.nodes.keys()) {
    const node = graph.nodes.get(nodeId)!;
    const replicas = Math.max(
      1,
      Math.floor(Number(node.customData.replicas) || 1)
    );
    const effectiveCapacity = resolveEffectiveCapacity(
      node.customData.maxCapacity,
      node.customData.replicas
    );

    metrics[nodeId] = {
      incoming: 0,
      processed: 0,
      dropped: 0,
      replicas,
      perReplicaIncoming: 0,
      effectiveCapacity,
    };
  }

  // Inject load into Clients and components with sourceRps
  for (const nodeId of topologicalOrder) {
    const node = graph.nodes.get(nodeId);
    if (!node) continue;
    
    const cType = node.customData.componentType || "";
    if (isClientType(cType)) {
      // Only inject global traffic if the client is connected to something
      if (node.outgoingEdges.length > 0) {
        metrics[nodeId].incoming += globalRps;
      }
    }
    if (node.customData.sourceRps && node.customData.sourceRps > 0) {
      metrics[nodeId].incoming += Number(node.customData.sourceRps);
    }
  }

  // Traverse in topological order to propagate load
  for (const nodeId of topologicalOrder) {
    const node = graph.nodes.get(nodeId);
    if (!node) continue;

    const currentMetrics = metrics[nodeId];
    const componentType = node.customData.componentType || "";
    const effectiveCapacity = currentMetrics.effectiveCapacity;

    // Process capacity limits — clients have no limits
    if (isClientType(componentType)) {
      currentMetrics.processed = currentMetrics.incoming;
      currentMetrics.dropped = 0;
    } else {
      const sourceTraffic = Number(node.customData.sourceRps) || 0;
      const externalIncoming = Math.max(
        0,
        currentMetrics.incoming - sourceTraffic
      );
      
      const externalProcessed = Math.min(externalIncoming, effectiveCapacity);
      
      currentMetrics.processed = externalProcessed + sourceTraffic;
      currentMetrics.dropped = Math.max(
        0,
        externalIncoming - effectiveCapacity
      );
    }

    // Compute per-replica incoming
    currentMetrics.perReplicaIncoming =
      currentMetrics.replicas > 1
        ? currentMetrics.incoming / currentMetrics.replicas
        : currentMetrics.incoming;

    const outgoingEdges = node.outgoingEdges;
    if (outgoingEdges.length === 0) continue;

    const processedRps = currentMetrics.processed;
    if (processedRps === 0) continue;

    // Determine target nodes
    const targets = outgoingEdges.map(edgeId => {
      const targetId = graph.edges.get(edgeId)?.targetId;
      return targetId ? graph.nodes.get(targetId) : null;
    }).filter(Boolean) as import("./GraphParser").GraphNode[];

    if (targets.length === 0) continue;

    // Resolve routing strategy from the registry
    const registryDef = COMPONENT_REGISTRY[componentType];
    const routingStrategy = registryDef?.routingStrategy ?? "round-robin";

    // Load Balancers support user-configured strategy overrides
    if (isLoadBalancerType(componentType)) {
      const strategy = node.customData.lbStrategy || "Round Robin";
      const allocations = distributeLoad(strategy, processedRps, targets);
      targets.forEach((t, i) => {
        metrics[t.id].incoming += allocations[i];
      });
    } else if (routingStrategy === "broadcast") {
      // Broadcast to all consumers (each gets full copy)
      targets.forEach(t => {
        metrics[t.id].incoming += processedRps;
      });
    } else {
      // Default: Split equally (round-robin, all, etc.)
      const split = processedRps / targets.length;
      targets.forEach(t => {
        metrics[t.id].incoming += split;
      });
    }
  }

  return metrics;
}

