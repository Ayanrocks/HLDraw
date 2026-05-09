import type { GraphNode } from "./GraphParser";

/**
 * Distributes processed RPS among targets using the specified load balancing strategy.
 * Returns an array of numbers representing the RPS allocated to each target,
 * in the same order as the provided targets array.
 */
export function distributeLoad(
  strategy: string,
  processedRps: number,
  targets: GraphNode[]
): number[] {
  if (targets.length === 0) return [];
  if (targets.length === 1) return [processedRps];

  switch (strategy) {
    case "Smart Load Monitor":
      return distributeSmartLoadMonitor(processedRps, targets);
    case "Consistent Hashing":
      return distributeConsistentHashing(processedRps, targets);
    case "Round Robin":
    default:
      return distributeRoundRobin(processedRps, targets);
  }
}

function distributeRoundRobin(processedRps: number, targets: GraphNode[]): number[] {
  const split = processedRps / targets.length;
  return targets.map(() => split);
}

function distributeSmartLoadMonitor(processedRps: number, targets: GraphNode[]): number[] {
  // Proportional to maxCapacity
  const capacities = targets.map((t) => Number(t.customData.maxCapacity) || 100);
  const totalCapacity = capacities.reduce((sum, cap) => sum + cap, 0);
  
  if (totalCapacity === 0) {
    return distributeRoundRobin(processedRps, targets);
  }

  return capacities.map((cap) => (cap / totalCapacity) * processedRps);
}

function distributeConsistentHashing(processedRps: number, targets: GraphNode[]): number[] {
  // To simulate consistent hashing in a steady-state RPS model,
  // we introduce a deterministic uneven distribution based on node IDs.
  // In a real hash ring, nodes "own" uneven segments of the hash space.
  const weights = targets.map((t) => {
    // Simple deterministic pseudo-random hash of the ID
    let hash = 0;
    for (let i = 0; i < t.id.length; i++) {
      hash = (hash << 5) - hash + t.id.charCodeAt(i);
      hash |= 0; 
    }
    // Normalize to a weight between 0.5 and 1.5 to simulate uneven bucket sizes
    const normalized = (Math.abs(hash) % 100) / 100; // 0.0 to 0.99
    return 0.5 + normalized;
  });

  const totalWeight = weights.reduce((sum, w) => sum + w, 0);
  
  if (totalWeight === 0) {
    return distributeRoundRobin(processedRps, targets);
  }

  return weights.map((w) => (w / totalWeight) * processedRps);
}
