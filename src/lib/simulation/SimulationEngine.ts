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
}

export function computeSimulationFrame(
  graph: Graph,
  topologicalOrder: string[],
  globalRps: number
): Record<string, NodeMetrics> {
  const metrics: Record<string, NodeMetrics> = {};

  // Initialize metrics for all nodes
  for (const nodeId of graph.nodes.keys()) {
    metrics[nodeId] = { incoming: 0, processed: 0, dropped: 0 };
  }

  // Inject load into Clients and components with sourceRps
  for (const nodeId of topologicalOrder) {
    const node = graph.nodes.get(nodeId);
    if (!node) continue;
    
    const cType = node.customData.componentType || "";
    if (isClientType(cType)) {
      metrics[nodeId].incoming += globalRps;
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
    const maxCapacity = Number(node.customData.maxCapacity) || Infinity;

    // Process capacity limits — clients have no limits
    if (isClientType(componentType)) {
      currentMetrics.processed = currentMetrics.incoming;
      currentMetrics.dropped = 0;
    } else {
      const sourceTraffic = Number(node.customData.sourceRps) || 0;
      const externalIncoming = Math.max(0, currentMetrics.incoming - sourceTraffic);
      
      const externalProcessed = Math.min(externalIncoming, maxCapacity);
      
      currentMetrics.processed = externalProcessed + sourceTraffic;
      currentMetrics.dropped = Math.max(0, externalIncoming - maxCapacity);
    }

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
