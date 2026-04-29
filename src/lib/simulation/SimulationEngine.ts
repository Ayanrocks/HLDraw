import type { Graph } from "./GraphParser";

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

  // Inject load into Clients
  for (const nodeId of topologicalOrder) {
    const node = graph.nodes.get(nodeId);
    if (node?.customData.componentType === "Client") {
      metrics[nodeId].incoming += globalRps;
    }
  }

  // Traverse in topological order to propagate load
  for (const nodeId of topologicalOrder) {
    const node = graph.nodes.get(nodeId);
    if (!node) continue;

    const currentMetrics = metrics[nodeId];
    const componentType = node.customData.componentType;
    const maxCapacity = Number(node.customData.maxCapacity) || Infinity;

    // Process capacity limits
    if (componentType === "Client") {
      currentMetrics.processed = currentMetrics.incoming; // Clients don't have capacity limits usually
      currentMetrics.dropped = 0;
    } else {
      currentMetrics.processed = Math.min(currentMetrics.incoming, maxCapacity);
      currentMetrics.dropped = Math.max(0, currentMetrics.incoming - maxCapacity);
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

    // Distribute traffic
    if (componentType === "ALB") {
      const strategy = node.customData.lbStrategy || "Round Robin";

      if (strategy === "Smart Load Monitor") {
        // Proportionally distribute based on target maxCapacity
        const totalCapacity = targets.reduce((sum, t) => sum + (Number(t.customData.maxCapacity) || 100), 0);
        targets.forEach(t => {
          const targetCap = Number(t.customData.maxCapacity) || 100;
          const share = (targetCap / totalCapacity) * processedRps;
          metrics[t.id].incoming += share;
        });
      } else {
        // Round Robin and Consistent Hashing effectively divide bulk RPS equally in a static frame
        const split = processedRps / targets.length;
        targets.forEach(t => {
          metrics[t.id].incoming += split;
        });
      }
    } else if (componentType === "Message Queue") {
      // Broadcast to all consumers (each gets full copy of message)
      targets.forEach(t => {
        metrics[t.id].incoming += processedRps;
      });
    } else {
      // Default: Split equally (Web Server, App Server, etc.)
      const split = processedRps / targets.length;
      targets.forEach(t => {
        metrics[t.id].incoming += split;
      });
    }
  }

  return metrics;
}
