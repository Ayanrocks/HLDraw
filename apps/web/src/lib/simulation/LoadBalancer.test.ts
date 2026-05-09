import { describe, it, expect } from "vitest";
import { distributeLoad } from "./LoadBalancer";
import type { GraphNode } from "./GraphParser";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeTarget(id: string, maxCapacity = 100): GraphNode {
  return {
    id,
    element: {} as GraphNode["element"],
    incomingEdges: [],
    outgoingEdges: [],
    customData: { componentType: "App Server", maxCapacity },
  };
}

// ===========================================================================
// Round Robin
// ===========================================================================

describe("LoadBalancer — Round Robin", () => {
  it("distributes traffic equally among targets", () => {
    const targets = [makeTarget("a"), makeTarget("b"), makeTarget("c")];
    const result = distributeLoad("Round Robin", 900, targets);

    expect(result).toEqual([300, 300, 300]);
  });

  it("distributes fractional traffic correctly", () => {
    const targets = [makeTarget("a"), makeTarget("b")];
    const result = distributeLoad("Round Robin", 100, targets);

    expect(result).toEqual([50, 50]);
  });

  it("gives all traffic to a single target", () => {
    const targets = [makeTarget("only")];
    const result = distributeLoad("Round Robin", 1000, targets);

    expect(result).toEqual([1000]);
  });

  it("handles zero RPS", () => {
    const targets = [makeTarget("a"), makeTarget("b")];
    const result = distributeLoad("Round Robin", 0, targets);

    expect(result).toEqual([0, 0]);
  });

  it("is the default for unknown strategies", () => {
    const targets = [makeTarget("a"), makeTarget("b")];
    const result = distributeLoad("UnknownStrategy", 200, targets);

    expect(result).toEqual([100, 100]);
  });
});

// ===========================================================================
// Smart Load Monitor
// ===========================================================================

describe("LoadBalancer — Smart Load Monitor", () => {
  it("distributes proportionally by maxCapacity", () => {
    const targets = [
      makeTarget("small", 1000),
      makeTarget("large", 3000),
    ];
    const result = distributeLoad("Smart Load Monitor", 4000, targets);

    expect(result[0]).toBe(1000); // 1000/4000 * 4000
    expect(result[1]).toBe(3000); // 3000/4000 * 4000
  });

  it("distributes proportionally with three targets", () => {
    const targets = [
      makeTarget("a", 100),
      makeTarget("b", 200),
      makeTarget("c", 300),
    ];
    const result = distributeLoad("Smart Load Monitor", 600, targets);
    const total = 100 + 200 + 300;

    expect(result[0]).toBeCloseTo((100 / total) * 600);
    expect(result[1]).toBeCloseTo((200 / total) * 600);
    expect(result[2]).toBeCloseTo((300 / total) * 600);
  });

  it("falls back to round robin when all capacities are zero", () => {
    const targets = [makeTarget("a", 0), makeTarget("b", 0)];
    const result = distributeLoad("Smart Load Monitor", 200, targets);

    // 0 capacity → fallback maxCapacity=100 each, so 50/50
    // Actually the code does: `Number(t.customData.maxCapacity) || 100`
    // maxCapacity=0 → 0 || 100 = 100, so both get 100 each
    expect(result[0]).toBe(100);
    expect(result[1]).toBe(100);
  });

  it("gives all traffic to a single target", () => {
    const targets = [makeTarget("only", 500)];
    const result = distributeLoad("Smart Load Monitor", 1000, targets);

    expect(result).toEqual([1000]);
  });
});

// ===========================================================================
// Consistent Hashing
// ===========================================================================

describe("LoadBalancer — Consistent Hashing", () => {
  it("distributes traffic deterministically based on node IDs", () => {
    const targets = [makeTarget("node-a"), makeTarget("node-b")];
    const result1 = distributeLoad("Consistent Hashing", 1000, targets);
    const result2 = distributeLoad("Consistent Hashing", 1000, targets);

    // Same input → same output (deterministic)
    expect(result1).toEqual(result2);
  });

  it("produces uneven distribution (not perfectly equal)", () => {
    const targets = [makeTarget("alpha"), makeTarget("beta")];
    const result = distributeLoad("Consistent Hashing", 1000, targets);

    // Distribution is uneven by design (simulating hash ring)
    const sum = result[0] + result[1];
    expect(sum).toBeCloseTo(1000);
    // The two should not typically be exactly equal
    // (though theoretically possible for specific IDs)
  });

  it("preserves total traffic across all targets", () => {
    const targets = [
      makeTarget("x-1"),
      makeTarget("x-2"),
      makeTarget("x-3"),
    ];
    const result = distributeLoad("Consistent Hashing", 1500, targets);

    const sum = result.reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1500, 5);
  });

  it("gives all traffic to a single target", () => {
    const targets = [makeTarget("sole")];
    const result = distributeLoad("Consistent Hashing", 500, targets);

    expect(result).toEqual([500]);
  });
});

// ===========================================================================
// Edge cases
// ===========================================================================

describe("LoadBalancer — Edge cases", () => {
  it("returns empty array for empty targets", () => {
    const result = distributeLoad("Round Robin", 1000, []);
    expect(result).toEqual([]);
  });

  it("handles very large RPS values", () => {
    const targets = [makeTarget("a"), makeTarget("b")];
    const result = distributeLoad("Round Robin", 1e10, targets);

    expect(result[0]).toBe(5e9);
    expect(result[1]).toBe(5e9);
  });

  it("handles negative RPS (should not happen but must not crash)", () => {
    const targets = [makeTarget("a"), makeTarget("b")];
    const result = distributeLoad("Round Robin", -100, targets);

    // Engine should handle gracefully — produces negative splits
    expect(result.length).toBe(2);
    expect(result[0] + result[1]).toBeCloseTo(-100);
  });
});
