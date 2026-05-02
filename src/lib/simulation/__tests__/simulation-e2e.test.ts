/**
 * End-to-end integration tests for the simulation pipeline.
 *
 * These tests exercise the full flow:
 *   ExcalidrawElement[] → parseGraph → validateDAG → computeSimulationFrame
 *
 * They verify that the entire system works together, catching integration
 * issues that unit tests on individual modules might miss.
 */
import { describe, it, expect } from "vitest";
import { parseGraph, validateDAG } from "../GraphParser";
import { computeSimulationFrame } from "../SimulationEngine";
import type { ExcalidrawElement } from "@excalidraw/excalidraw/element/types";
import { createMockElement, createMockArrow } from "./helpers";

/**
 * Runs the full simulation pipeline on a set of mock elements.
 */
function runSimulation(
  elements: Record<string, unknown>[],
  globalRps: number
) {
  const graph = parseGraph(elements as unknown as ExcalidrawElement[]);
  const validation = validateDAG(graph);

  return { graph, validation, metrics: validation.isValid && validation.topologicalOrder
    ? computeSimulationFrame(graph, validation.topologicalOrder, globalRps)
    : null,
  };
}

// ===========================================================================
// E2E: Simple linear architectures
// ===========================================================================

describe("E2E — Simple linear architectures", () => {
  it("Client → App Server → Database (within capacity)", () => {
    const elements = [
      createMockElement("c", "rectangle", { componentType: "Client" }),
      createMockElement("s", "rectangle", {
        componentType: "App Server",
        maxCapacity: 1000,
      }),
      createMockElement("db", "rectangle", {
        componentType: "Database",
        maxCapacity: 2000,
      }),
      createMockArrow("e1", "c", "s"),
      createMockArrow("e2", "s", "db"),
    ];

    const { validation, metrics } = runSimulation(elements, 500);

    expect(validation.isValid).toBe(true);
    expect(metrics).not.toBeNull();

    expect(metrics!["c"].processed).toBe(500);
    expect(metrics!["s"].incoming).toBe(500);
    expect(metrics!["s"].processed).toBe(500);
    expect(metrics!["s"].dropped).toBe(0);
    expect(metrics!["db"].incoming).toBe(500);
    expect(metrics!["db"].dropped).toBe(0);
  });

  it("Client → App Server → Database (server bottleneck)", () => {
    const elements = [
      createMockElement("c", "rectangle", { componentType: "Client" }),
      createMockElement("s", "rectangle", {
        componentType: "App Server",
        maxCapacity: 200,
      }),
      createMockElement("db", "rectangle", {
        componentType: "Database",
        maxCapacity: 5000,
      }),
      createMockArrow("e1", "c", "s"),
      createMockArrow("e2", "s", "db"),
    ];

    const { metrics } = runSimulation(elements, 1000);

    expect(metrics!["s"].incoming).toBe(1000);
    expect(metrics!["s"].processed).toBe(200);
    expect(metrics!["s"].dropped).toBe(800);
    // DB only receives what server processed
    expect(metrics!["db"].incoming).toBe(200);
    expect(metrics!["db"].dropped).toBe(0);
  });
});

// ===========================================================================
// E2E: Load-balanced architectures
// ===========================================================================

describe("E2E — Load-balanced architectures", () => {
  it("Client → LB → 2 Servers → Database (round-robin, within capacity)", () => {
    const elements = [
      createMockElement("c", "rectangle", { componentType: "Client" }),
      createMockElement("lb", "rectangle", {
        componentType: "Load Balancer",
        maxCapacity: 10000,
        lbStrategy: "Round Robin",
      }),
      createMockElement("s1", "rectangle", {
        componentType: "App Server",
        maxCapacity: 1000,
      }),
      createMockElement("s2", "rectangle", {
        componentType: "App Server",
        maxCapacity: 1000,
      }),
      createMockElement("db", "rectangle", {
        componentType: "Database",
        maxCapacity: 5000,
      }),
      createMockArrow("e1", "c", "lb"),
      createMockArrow("e2", "lb", "s1"),
      createMockArrow("e3", "lb", "s2"),
      createMockArrow("e4", "s1", "db"),
      createMockArrow("e5", "s2", "db"),
    ];

    const { metrics } = runSimulation(elements, 1000);

    expect(metrics!["lb"].processed).toBe(1000);
    expect(metrics!["s1"].incoming).toBe(500);
    expect(metrics!["s2"].incoming).toBe(500);
    expect(metrics!["s1"].dropped).toBe(0);
    expect(metrics!["s2"].dropped).toBe(0);
    expect(metrics!["db"].incoming).toBe(1000);
  });

  it("Client → LB → 2 Servers (overloaded servers drop traffic)", () => {
    const elements = [
      createMockElement("c", "rectangle", { componentType: "Client" }),
      createMockElement("lb", "rectangle", {
        componentType: "Load Balancer",
        maxCapacity: 10000,
        lbStrategy: "Round Robin",
      }),
      createMockElement("s1", "rectangle", {
        componentType: "App Server",
        maxCapacity: 300,
      }),
      createMockElement("s2", "rectangle", {
        componentType: "App Server",
        maxCapacity: 300,
      }),
      createMockArrow("e1", "c", "lb"),
      createMockArrow("e2", "lb", "s1"),
      createMockArrow("e3", "lb", "s2"),
    ];

    const { metrics } = runSimulation(elements, 2000);

    // LB splits 2000 evenly → 1000 each
    expect(metrics!["s1"].incoming).toBe(1000);
    expect(metrics!["s1"].processed).toBe(300);
    expect(metrics!["s1"].dropped).toBe(700);

    expect(metrics!["s2"].incoming).toBe(1000);
    expect(metrics!["s2"].processed).toBe(300);
    expect(metrics!["s2"].dropped).toBe(700);
  });

  it("Client → LB → 2 Servers (Smart LB proportional distribution)", () => {
    const elements = [
      createMockElement("c", "rectangle", { componentType: "Client" }),
      createMockElement("lb", "rectangle", {
        componentType: "Load Balancer",
        maxCapacity: 10000,
        lbStrategy: "Smart Load Monitor",
      }),
      createMockElement("s1", "rectangle", {
        componentType: "App Server",
        maxCapacity: 1000,
      }),
      createMockElement("s2", "rectangle", {
        componentType: "App Server",
        maxCapacity: 4000,
      }),
      createMockArrow("e1", "c", "lb"),
      createMockArrow("e2", "lb", "s1"),
      createMockArrow("e3", "lb", "s2"),
    ];

    const { metrics } = runSimulation(elements, 5000);

    // Proportional: s1 gets 1/5, s2 gets 4/5
    expect(metrics!["s1"].incoming).toBe(1000);
    expect(metrics!["s2"].incoming).toBe(4000);
  });
});

// ===========================================================================
// E2E: sourceRps-driven architectures (no Client node)
// ===========================================================================

describe("E2E — sourceRps-driven architectures", () => {
  it("Cron job (sourceRps) → Database", () => {
    const elements = [
      createMockElement("cron", "rectangle", {
        componentType: "App Server",
        maxCapacity: 5000,
        sourceRps: 100,
      }),
      createMockElement("db", "rectangle", {
        componentType: "Database",
        maxCapacity: 2000,
      }),
      createMockArrow("e1", "cron", "db"),
    ];

    const { validation, metrics } = runSimulation(elements, 0);

    expect(validation.isValid).toBe(true);
    expect(metrics!["cron"].incoming).toBe(100);
    expect(metrics!["cron"].processed).toBe(100);
    expect(metrics!["db"].incoming).toBe(100);
  });

  it("Client + sourceRps producer → shared Database", () => {
    const elements = [
      createMockElement("c", "rectangle", { componentType: "Client" }),
      createMockElement("api", "rectangle", {
        componentType: "App Server",
        maxCapacity: 5000,
      }),
      createMockElement("producer", "rectangle", {
        componentType: "App Server",
        maxCapacity: 5000,
        sourceRps: 200,
      }),
      createMockElement("db", "rectangle", {
        componentType: "Database",
        maxCapacity: 10000,
      }),
      createMockArrow("e1", "c", "api"),
      createMockArrow("e2", "api", "db"),
      createMockArrow("e3", "producer", "db"),
    ];

    const { metrics } = runSimulation(elements, 500);

    // api receives 500 from client, producer generates 200 internally
    expect(metrics!["api"].incoming).toBe(500);
    expect(metrics!["producer"].incoming).toBe(200);
    expect(metrics!["db"].incoming).toBe(700); // 500 + 200
  });
});

// ===========================================================================
// E2E: Complex multi-tier architecture
// ===========================================================================

describe("E2E — Complex multi-tier architecture", () => {
  it("Client → CDN → LB → 3 Servers → Cache → Database (full pipeline)", () => {
    const elements = [
      createMockElement("c", "rectangle", { componentType: "Client" }),
      createMockElement("cdn", "rectangle", {
        componentType: "CDN",
        maxCapacity: 50000,
      }),
      createMockElement("lb", "rectangle", {
        componentType: "Load Balancer",
        maxCapacity: 10000,
        lbStrategy: "Round Robin",
      }),
      createMockElement("s1", "rectangle", {
        componentType: "App Server",
        maxCapacity: 2000,
      }),
      createMockElement("s2", "rectangle", {
        componentType: "App Server",
        maxCapacity: 2000,
      }),
      createMockElement("s3", "rectangle", {
        componentType: "App Server",
        maxCapacity: 2000,
      }),
      createMockElement("cache", "rectangle", {
        componentType: "Cache",
        maxCapacity: 20000,
      }),
      createMockElement("db", "rectangle", {
        componentType: "Database",
        maxCapacity: 5000,
      }),
      // Edges
      createMockArrow("e1", "c", "cdn"),
      createMockArrow("e2", "cdn", "lb"),
      createMockArrow("e3", "lb", "s1"),
      createMockArrow("e4", "lb", "s2"),
      createMockArrow("e5", "lb", "s3"),
      createMockArrow("e6", "s1", "cache"),
      createMockArrow("e7", "s2", "cache"),
      createMockArrow("e8", "s3", "cache"),
      createMockArrow("e9", "cache", "db"),
    ];

    const { validation, metrics } = runSimulation(elements, 3000);

    expect(validation.isValid).toBe(true);
    expect(metrics).not.toBeNull();

    // CDN and LB pass through
    expect(metrics!["cdn"].processed).toBe(3000);
    expect(metrics!["lb"].processed).toBe(3000);

    // Each server gets 1000
    expect(metrics!["s1"].incoming).toBe(1000);
    expect(metrics!["s2"].incoming).toBe(1000);
    expect(metrics!["s3"].incoming).toBe(1000);

    // Cache receives aggregate from all servers
    expect(metrics!["cache"].incoming).toBe(3000);
    expect(metrics!["cache"].processed).toBe(3000);

    // Database receives from cache
    expect(metrics!["db"].incoming).toBe(3000);
    expect(metrics!["db"].dropped).toBe(0);
  });

  it("identifies bottleneck in deep pipeline", () => {
    const elements = [
      createMockElement("c", "rectangle", { componentType: "Client" }),
      createMockElement("cdn", "rectangle", {
        componentType: "CDN",
        maxCapacity: 50000,
      }),
      createMockElement("lb", "rectangle", {
        componentType: "Load Balancer",
        maxCapacity: 10000,
        lbStrategy: "Round Robin",
      }),
      createMockElement("s1", "rectangle", {
        componentType: "App Server",
        maxCapacity: 500,
      }),
      createMockElement("s2", "rectangle", {
        componentType: "App Server",
        maxCapacity: 500,
      }),
      createMockElement("db", "rectangle", {
        componentType: "Database",
        maxCapacity: 200,
      }),
      createMockArrow("e1", "c", "cdn"),
      createMockArrow("e2", "cdn", "lb"),
      createMockArrow("e3", "lb", "s1"),
      createMockArrow("e4", "lb", "s2"),
      createMockArrow("e5", "s1", "db"),
      createMockArrow("e6", "s2", "db"),
    ];

    const { metrics } = runSimulation(elements, 2000);

    // LB splits 2000 → 1000 each
    expect(metrics!["s1"].incoming).toBe(1000);
    expect(metrics!["s1"].processed).toBe(500);
    expect(metrics!["s1"].dropped).toBe(500);

    expect(metrics!["s2"].incoming).toBe(1000);
    expect(metrics!["s2"].processed).toBe(500);
    expect(metrics!["s2"].dropped).toBe(500);

    // DB receives 500 + 500 = 1000, but capacity is only 200
    expect(metrics!["db"].incoming).toBe(1000);
    expect(metrics!["db"].processed).toBe(200);
    expect(metrics!["db"].dropped).toBe(800);
  });
});

// ===========================================================================
// E2E: Validation failures
// ===========================================================================

describe("E2E — Validation failures prevent simulation", () => {
  it("returns null metrics for cyclic graph", () => {
    const elements = [
      createMockElement("a", "rectangle", { componentType: "Client" }),
      createMockElement("b", "rectangle", { componentType: "App Server" }),
      createMockElement("c", "rectangle", { componentType: "Database" }),
      createMockArrow("e1", "a", "b"),
      createMockArrow("e2", "b", "c"),
      createMockArrow("e3", "c", "b"), // cycle
    ];

    const { validation, metrics } = runSimulation(elements, 1000);

    expect(validation.isValid).toBe(false);
    expect(metrics).toBeNull();
  });

  it("returns null metrics for missing traffic source", () => {
    const elements = [
      createMockElement("lb", "rectangle", {
        componentType: "Load Balancer",
      }),
      createMockElement("s", "rectangle", { componentType: "App Server" }),
      createMockArrow("e1", "lb", "s"),
    ];

    const { validation, metrics } = runSimulation(elements, 1000);

    expect(validation.isValid).toBe(false);
    expect(metrics).toBeNull();
  });

  it("returns null metrics for untyped connected components", () => {
    const elements = [
      createMockElement("c", "rectangle", { componentType: "Client" }),
      createMockElement("mystery", "rectangle", {}),
      createMockArrow("e1", "c", "mystery"),
    ];

    const { validation, metrics } = runSimulation(elements, 500);

    expect(validation.isValid).toBe(false);
    expect(metrics).toBeNull();
  });
});

// ===========================================================================
// E2E: Disconnected subgraph handling
// ===========================================================================

describe("E2E — Disconnected components", () => {
  it("disconnected nodes have zero load", () => {
    const elements = [
      createMockElement("c", "rectangle", { componentType: "Client" }),
      createMockElement("s", "rectangle", {
        componentType: "App Server",
        maxCapacity: 1000,
      }),
      createMockElement("isolated", "rectangle", {
        componentType: "Database",
        maxCapacity: 5000,
      }),
      createMockArrow("e1", "c", "s"),
      // "isolated" has no edges
    ];

    const { metrics } = runSimulation(elements, 500);

    expect(metrics!["s"].incoming).toBe(500);
    expect(metrics!["isolated"].incoming).toBe(0);
    expect(metrics!["isolated"].processed).toBe(0);
  });

  it("disconnected client does not inject traffic", () => {
    const elements = [
      createMockElement("c1", "rectangle", { componentType: "Client" }),
      createMockElement("c2", "rectangle", { componentType: "Client" }),
      createMockElement("s", "rectangle", {
        componentType: "App Server",
        maxCapacity: 1000,
      }),
      createMockArrow("e1", "c1", "s"),
      // c2 is disconnected — should not inject traffic
    ];

    const { metrics } = runSimulation(elements, 500);

    expect(metrics!["c1"].incoming).toBe(500);
    expect(metrics!["c2"].incoming).toBe(0);
    expect(metrics!["s"].incoming).toBe(500);
  });
});
