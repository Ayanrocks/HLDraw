import { describe, it, expect } from "vitest";
import {
  computeSimulationFrame,
  resolveEffectiveCapacity,
} from "./SimulationEngine";
import { buildGraph } from "./__tests__/helpers";

// ---------------------------------------------------------------------------
// resolveEffectiveCapacity unit tests
// ---------------------------------------------------------------------------

describe("resolveEffectiveCapacity", () => {
  it("returns perInstance capacity when replicas is 1", () => {
    expect(resolveEffectiveCapacity(500, 1)).toBe(500);
  });

  it("multiplies capacity by replica count", () => {
    expect(resolveEffectiveCapacity(500, 3)).toBe(1500);
  });

  it("returns Infinity when maxCapacity is undefined", () => {
    expect(resolveEffectiveCapacity(undefined, 3)).toBe(Infinity);
  });

  it("returns Infinity when maxCapacity is null", () => {
    expect(resolveEffectiveCapacity(null, 2)).toBe(Infinity);
  });

  it("treats zero maxCapacity as Infinity (falsy → Infinity)", () => {
    expect(resolveEffectiveCapacity(0, 5)).toBe(Infinity);
  });

  it("defaults replicas to 1 when undefined", () => {
    expect(resolveEffectiveCapacity(1000, undefined)).toBe(1000);
  });

  it("defaults replicas to 1 when null", () => {
    expect(resolveEffectiveCapacity(1000, null)).toBe(1000);
  });

  it("floors fractional replicas (e.g. 2.7 → 2)", () => {
    expect(resolveEffectiveCapacity(1000, 2.7)).toBe(2000);
  });

  it("clamps negative replicas to 1", () => {
    expect(resolveEffectiveCapacity(1000, -3)).toBe(1000);
  });

  it("clamps zero replicas to 1", () => {
    expect(resolveEffectiveCapacity(1000, 0)).toBe(1000);
  });
});

// ---------------------------------------------------------------------------
// Simulation engine — autoscaling integration
// ---------------------------------------------------------------------------

describe("SimulationEngine — Autoscaling (replicas)", () => {
  it("scales capacity by replica count — no drops at scaled capacity", () => {
    const graph = buildGraph(
      [
        { id: "client", customData: { componentType: "Client" } },
        {
          id: "server",
          customData: {
            componentType: "App Server",
            maxCapacity: 500,
            replicas: 3,
          },
        },
      ],
      [{ id: "e1", sourceId: "client", targetId: "server" }]
    );

    const result = computeSimulationFrame(
      graph,
      ["client", "server"],
      1500
    );

    // effective capacity = 500 × 3 = 1500
    expect(result["server"].incoming).toBe(1500);
    expect(result["server"].processed).toBe(1500);
    expect(result["server"].dropped).toBe(0);
    expect(result["server"].effectiveCapacity).toBe(1500);
    expect(result["server"].replicas).toBe(3);
  });

  it("drops traffic when exceeding scaled capacity", () => {
    const graph = buildGraph(
      [
        { id: "client", customData: { componentType: "Client" } },
        {
          id: "server",
          customData: {
            componentType: "App Server",
            maxCapacity: 500,
            replicas: 2,
          },
        },
      ],
      [{ id: "e1", sourceId: "client", targetId: "server" }]
    );

    const result = computeSimulationFrame(
      graph,
      ["client", "server"],
      1500
    );

    // effective capacity = 500 × 2 = 1000
    expect(result["server"].incoming).toBe(1500);
    expect(result["server"].processed).toBe(1000);
    expect(result["server"].dropped).toBe(500);
  });

  it("computes perReplicaIncoming correctly", () => {
    const graph = buildGraph(
      [
        { id: "client", customData: { componentType: "Client" } },
        {
          id: "server",
          customData: {
            componentType: "App Server",
            maxCapacity: 1000,
            replicas: 4,
          },
        },
      ],
      [{ id: "e1", sourceId: "client", targetId: "server" }]
    );

    const result = computeSimulationFrame(
      graph,
      ["client", "server"],
      2000
    );

    // perReplicaIncoming = 2000 / 4 = 500
    expect(result["server"].perReplicaIncoming).toBe(500);
    expect(result["server"].replicas).toBe(4);
  });

  it("perReplicaIncoming equals incoming when replicas is 1", () => {
    const graph = buildGraph(
      [
        { id: "client", customData: { componentType: "Client" } },
        {
          id: "server",
          customData: {
            componentType: "App Server",
            maxCapacity: 1000,
            replicas: 1,
          },
        },
      ],
      [{ id: "e1", sourceId: "client", targetId: "server" }]
    );

    const result = computeSimulationFrame(
      graph,
      ["client", "server"],
      800
    );

    expect(result["server"].perReplicaIncoming).toBe(800);
    expect(result["server"].incoming).toBe(800);
  });

  it("handles replicas with sourceRps — sourceRps bypasses capacity check", () => {
    const graph = buildGraph(
      [
        { id: "client", customData: { componentType: "Client" } },
        {
          id: "server",
          customData: {
            componentType: "App Server",
            maxCapacity: 200,
            replicas: 2,
            sourceRps: 100,
          },
        },
      ],
      [{ id: "e1", sourceId: "client", targetId: "server" }]
    );

    const result = computeSimulationFrame(
      graph,
      ["client", "server"],
      500
    );

    // incoming = 500 (from client) + 100 (sourceRps) = 600
    // effective capacity = 200 × 2 = 400
    // externalIncoming = 600 - 100 = 500
    // externalProcessed = min(500, 400) = 400
    // processed = 400 + 100 = 500
    // dropped = 500 - 400 = 100
    expect(result["server"].incoming).toBe(600);
    expect(result["server"].processed).toBe(500);
    expect(result["server"].dropped).toBe(100);
  });

  it("defaults replicas to 1 when not set", () => {
    const graph = buildGraph(
      [
        { id: "client", customData: { componentType: "Client" } },
        {
          id: "server",
          customData: {
            componentType: "App Server",
            maxCapacity: 500,
          },
        },
      ],
      [{ id: "e1", sourceId: "client", targetId: "server" }]
    );

    const result = computeSimulationFrame(
      graph,
      ["client", "server"],
      500
    );

    expect(result["server"].replicas).toBe(1);
    expect(result["server"].effectiveCapacity).toBe(500);
    expect(result["server"].processed).toBe(500);
  });

  it("cascades correctly through multi-hop with scaled nodes", () => {
    const graph = buildGraph(
      [
        { id: "client", customData: { componentType: "Client" } },
        {
          id: "lb",
          customData: {
            componentType: "Load Balancer",
            maxCapacity: 10000,
            replicas: 1,
          },
        },
        {
          id: "server",
          customData: {
            componentType: "App Server",
            maxCapacity: 500,
            replicas: 4,
          },
        },
        {
          id: "db",
          customData: {
            componentType: "Database",
            maxCapacity: 3000,
            replicas: 2,
          },
        },
      ],
      [
        { id: "e1", sourceId: "client", targetId: "lb" },
        { id: "e2", sourceId: "lb", targetId: "server" },
        { id: "e3", sourceId: "server", targetId: "db" },
      ]
    );

    const result = computeSimulationFrame(
      graph,
      ["client", "lb", "server", "db"],
      2000
    );

    // server effective capacity = 500 × 4 = 2000
    expect(result["server"].effectiveCapacity).toBe(2000);
    expect(result["server"].incoming).toBe(2000);
    expect(result["server"].processed).toBe(2000);
    expect(result["server"].dropped).toBe(0);

    // db effective capacity = 3000 × 2 = 6000
    expect(result["db"].effectiveCapacity).toBe(6000);
    expect(result["db"].incoming).toBe(2000);
    expect(result["db"].processed).toBe(2000);
    expect(result["db"].dropped).toBe(0);
  });

  it("handles bottleneck at scaled tier with downstream effects", () => {
    const graph = buildGraph(
      [
        { id: "client", customData: { componentType: "Client" } },
        {
          id: "web",
          customData: {
            componentType: "Web Server",
            maxCapacity: 1000,
            replicas: 2,
          },
        },
        {
          id: "app",
          customData: {
            componentType: "App Server",
            maxCapacity: 300,
            replicas: 2,
          },
        },
      ],
      [
        { id: "e1", sourceId: "client", targetId: "web" },
        { id: "e2", sourceId: "web", targetId: "app" },
      ]
    );

    const result = computeSimulationFrame(
      graph,
      ["client", "web", "app"],
      3000
    );

    // web effective = 1000 × 2 = 2000 → drops 1000
    expect(result["web"].processed).toBe(2000);
    expect(result["web"].dropped).toBe(1000);

    // app effective = 300 × 2 = 600 → receives 2000, drops 1400
    expect(result["app"].incoming).toBe(2000);
    expect(result["app"].processed).toBe(600);
    expect(result["app"].dropped).toBe(1400);
  });

  it("handles LB distributing to scaled backends", () => {
    const graph = buildGraph(
      [
        { id: "client", customData: { componentType: "Client" } },
        {
          id: "lb",
          customData: {
            componentType: "Load Balancer",
            maxCapacity: 50000,
            lbStrategy: "Round Robin",
          },
        },
        {
          id: "s1",
          customData: {
            componentType: "App Server",
            maxCapacity: 200,
            replicas: 5,
          },
        },
        {
          id: "s2",
          customData: {
            componentType: "App Server",
            maxCapacity: 200,
            replicas: 3,
          },
        },
      ],
      [
        { id: "e1", sourceId: "client", targetId: "lb" },
        { id: "e2", sourceId: "lb", targetId: "s1" },
        { id: "e3", sourceId: "lb", targetId: "s2" },
      ]
    );

    const result = computeSimulationFrame(
      graph,
      ["client", "lb", "s1", "s2"],
      2000
    );

    // LB distributes round robin: each gets 1000
    // s1: effective = 200 × 5 = 1000 → processes all 1000
    expect(result["s1"].incoming).toBe(1000);
    expect(result["s1"].processed).toBe(1000);
    expect(result["s1"].dropped).toBe(0);

    // s2: effective = 200 × 3 = 600 → drops 400
    expect(result["s2"].incoming).toBe(1000);
    expect(result["s2"].processed).toBe(600);
    expect(result["s2"].dropped).toBe(400);
  });
});
