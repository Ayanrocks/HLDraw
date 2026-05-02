import { describe, it, expect } from "vitest";
import {
  parseGraph,
  getTopologicalOrder,
  validateDAG,
} from "./GraphParser";
import type { ExcalidrawElement, ExcalidrawArrowElement } from "@excalidraw/excalidraw/element/types";
import { createMockElement, createMockArrow } from "./__tests__/helpers";

// ===========================================================================
// parseGraph — Success
// ===========================================================================

describe("GraphParser — parseGraph success", () => {
  it("parses basic nodes without connections", () => {
    const elements = [
      createMockElement("node1", "rectangle", { componentType: "Client" }),
      createMockElement("node2", "diamond", { componentType: "Database" }),
    ] as unknown as ExcalidrawElement[];

    const graph = parseGraph(elements);

    expect(graph.nodes.size).toBe(2);
    expect(graph.edges.size).toBe(0);
    expect(graph.nodes.get("node1")?.customData.componentType).toBe("Client");
  });

  it("parses arrows into edges and connects incoming/outgoing links", () => {
    const elements = [
      createMockElement("client1", "rectangle", { componentType: "Client" }),
      createMockElement("server1", "rectangle", {
        componentType: "App Server",
      }),
      createMockArrow("arrow1", "client1", "server1"),
    ] as unknown as ExcalidrawElement[];

    const graph = parseGraph(elements);

    expect(graph.nodes.size).toBe(2);
    expect(graph.edges.size).toBe(1);

    const edge = graph.edges.get("arrow1");
    expect(edge).toBeDefined();
    expect(edge?.sourceId).toBe("client1");
    expect(edge?.targetId).toBe("server1");

    expect(graph.nodes.get("client1")?.outgoingEdges).toContain("arrow1");
    expect(graph.nodes.get("client1")?.incomingEdges.length).toBe(0);

    expect(graph.nodes.get("server1")?.incomingEdges).toContain("arrow1");
    expect(graph.nodes.get("server1")?.outgoingEdges.length).toBe(0);
  });

  it("skips deleted elements", () => {
    const elements = [
      createMockElement("alive", "rectangle", { componentType: "Client" }),
      createMockElement("dead", "rectangle", { componentType: "Database" }, {
        isDeleted: true,
      }),
    ] as unknown as ExcalidrawElement[];

    const graph = parseGraph(elements);

    expect(graph.nodes.size).toBe(1);
    expect(graph.nodes.has("dead")).toBe(false);
  });

  it("skips text elements and freedraw elements", () => {
    const elements = [
      createMockElement("shape", "rectangle", { componentType: "Client" }),
      createMockElement("text1", "text", {}),
      createMockElement("draw1", "freedraw", {}),
    ] as unknown as ExcalidrawElement[];

    const graph = parseGraph(elements);

    expect(graph.nodes.size).toBe(1);
    expect(graph.nodes.has("shape")).toBe(true);
  });

  it("skips elements bound to a container (labels)", () => {
    const elements = [
      createMockElement("container", "rectangle", {
        componentType: "App Server",
      }),
      createMockElement("label", "rectangle", {}, { containerId: "container" }),
    ] as unknown as ExcalidrawElement[];

    const graph = parseGraph(elements);

    expect(graph.nodes.size).toBe(1);
    expect(graph.nodes.has("container")).toBe(true);
  });

  it("merges grouped elements into a single logical node", () => {
    const elements = [
      createMockElement("rect1", "rectangle", { componentType: "App Server" }, {
        groupIds: ["group-A"],
      }),
      createMockElement("rect2", "rectangle", { name: "extra info" }, {
        groupIds: ["group-A"],
      }),
    ] as unknown as ExcalidrawElement[];

    const graph = parseGraph(elements);

    // Both should be merged into one node with ID "group-A"
    expect(graph.nodes.size).toBe(1);
    expect(graph.nodes.has("group-A")).toBe(true);
    expect(graph.nodes.get("group-A")?.customData.componentType).toBe(
      "App Server"
    );
    expect(graph.nodes.get("group-A")?.customData.name).toBe("extra info");
  });

  it("uses top-level group ID for nested groups", () => {
    const elements = [
      createMockElement("rect1", "rectangle", { componentType: "Server" }, {
        groupIds: ["inner", "outer"],
      }),
    ] as unknown as ExcalidrawElement[];

    const graph = parseGraph(elements);

    // Should use the last group ID (outermost)
    expect(graph.nodes.has("outer")).toBe(true);
  });

  it("handles complex multi-node multi-edge graph", () => {
    const elements = [
      createMockElement("c", "rectangle", { componentType: "Client" }),
      createMockElement("lb", "rectangle", { componentType: "Load Balancer" }),
      createMockElement("s1", "rectangle", { componentType: "App Server" }),
      createMockElement("s2", "rectangle", { componentType: "App Server" }),
      createMockElement("db", "rectangle", { componentType: "Database" }),
      createMockArrow("a1", "c", "lb"),
      createMockArrow("a2", "lb", "s1"),
      createMockArrow("a3", "lb", "s2"),
      createMockArrow("a4", "s1", "db"),
      createMockArrow("a5", "s2", "db"),
    ] as unknown as ExcalidrawElement[];

    const graph = parseGraph(elements);

    expect(graph.nodes.size).toBe(5);
    expect(graph.edges.size).toBe(5);
    expect(graph.nodes.get("lb")?.outgoingEdges.length).toBe(2);
    expect(graph.nodes.get("db")?.incomingEdges.length).toBe(2);
  });
});

// ===========================================================================
// parseGraph — Failure / edge cases
// ===========================================================================

describe("GraphParser — parseGraph failure cases", () => {
  it("ignores dangling arrows (missing target binding)", () => {
    const elements = [
      createMockElement("client1", "rectangle", { componentType: "Client" }),
      createMockArrow("arrow_dangling", "client1", null),
    ] as unknown as ExcalidrawElement[];

    const graph = parseGraph(elements);

    expect(graph.nodes.size).toBe(1);
    expect(graph.edges.size).toBe(0);
    expect(graph.nodes.get("client1")?.outgoingEdges.length).toBe(0);
  });

  it("ignores arrows pointing to non-existent nodes", () => {
    const elements = [
      createMockElement("client1", "rectangle", { componentType: "Client" }),
      createMockArrow("arrow1", "client1", "ghost_node"),
    ] as unknown as ExcalidrawElement[];

    const graph = parseGraph(elements);

    expect(graph.edges.size).toBe(0);
  });

  it("ignores deleted arrows", () => {
    const elements = [
      createMockElement("c", "rectangle", { componentType: "Client" }),
      createMockElement("s", "rectangle", { componentType: "App Server" }),
      createMockArrow("dead_arrow", "c", "s", { isDeleted: true }),
    ] as unknown as ExcalidrawElement[];

    const graph = parseGraph(elements);

    expect(graph.edges.size).toBe(0);
  });

  it("handles empty elements array", () => {
    const graph = parseGraph([]);

    expect(graph.nodes.size).toBe(0);
    expect(graph.edges.size).toBe(0);
  });
});

// ===========================================================================
// getTopologicalOrder
// ===========================================================================

describe("GraphParser — getTopologicalOrder", () => {
  it("returns correct linear order for a chain", () => {
    const elements = [
      createMockElement("a", "rectangle", { componentType: "Client" }),
      createMockElement("b", "rectangle", { componentType: "App Server" }),
      createMockElement("c", "rectangle", { componentType: "Database" }),
      createMockArrow("e1", "a", "b"),
      createMockArrow("e2", "b", "c"),
    ] as unknown as ExcalidrawElement[];

    const graph = parseGraph(elements);
    const { order, error } = getTopologicalOrder(graph);

    expect(error).toBeUndefined();
    expect(order.indexOf("a")).toBeLessThan(order.indexOf("b"));
    expect(order.indexOf("b")).toBeLessThan(order.indexOf("c"));
  });

  it("detects cycles and returns error", () => {
    const elements = [
      createMockElement("a", "rectangle", { componentType: "Client" }),
      createMockElement("b", "rectangle", { componentType: "App Server" }),
      createMockElement("c", "rectangle", { componentType: "Database" }),
      createMockArrow("e1", "a", "b"),
      createMockArrow("e2", "b", "c"),
      createMockArrow("e3", "c", "b"), // cycle
    ] as unknown as ExcalidrawElement[];

    const graph = parseGraph(elements);
    const { order, error, errorNodes } = getTopologicalOrder(graph);

    expect(error).toContain("Cyclic flow detected");
    expect(order).toEqual([]);
    expect(errorNodes).toBeDefined();
    expect(errorNodes!.length).toBeGreaterThan(0);
  });

  it("handles isolated nodes (all in-degree 0)", () => {
    const elements = [
      createMockElement("x", "rectangle", { componentType: "App Server" }),
      createMockElement("y", "rectangle", { componentType: "Database" }),
    ] as unknown as ExcalidrawElement[];

    const graph = parseGraph(elements);
    const { order, error } = getTopologicalOrder(graph);

    expect(error).toBeUndefined();
    expect(order.length).toBe(2);
    expect(order).toContain("x");
    expect(order).toContain("y");
  });
});

// ===========================================================================
// validateDAG — Success
// ===========================================================================

describe("GraphParser — validateDAG success", () => {
  it("returns valid for a proper DAG with a Client", () => {
    const elements = [
      createMockElement("c", "rectangle", { componentType: "Client" }),
      createMockElement("s", "rectangle", { componentType: "App Server" }),
      createMockArrow("a1", "c", "s"),
    ] as unknown as ExcalidrawElement[];

    const graph = parseGraph(elements);
    const result = validateDAG(graph);

    expect(result.isValid).toBe(true);
    expect(result.topologicalOrder).toBeDefined();
    expect(result.topologicalOrder!.length).toBe(2);
  });

  it("returns valid for a graph with sourceRps instead of Client", () => {
    const elements = [
      createMockElement("cron", "rectangle", {
        componentType: "App Server",
        sourceRps: 100,
      }),
      createMockElement("db", "rectangle", { componentType: "Database" }),
      createMockArrow("a1", "cron", "db"),
    ] as unknown as ExcalidrawElement[];

    const graph = parseGraph(elements);
    const result = validateDAG(graph);

    expect(result.isValid).toBe(true);
  });

  it("allows isolated untyped shapes (decorative elements)", () => {
    const elements = [
      createMockElement("c", "rectangle", { componentType: "Client" }),
      createMockElement("s", "rectangle", { componentType: "App Server" }),
      createMockArrow("a1", "c", "s"),
      createMockElement("decoration", "rectangle", {}), // no type, no edges
    ] as unknown as ExcalidrawElement[];

    const graph = parseGraph(elements);
    const result = validateDAG(graph);

    expect(result.isValid).toBe(true);
  });

  it("allows isolated nodes with no edges and no source", () => {
    const elements = [
      createMockElement("lone", "rectangle", { componentType: "App Server" }),
    ] as unknown as ExcalidrawElement[];

    const graph = parseGraph(elements);
    const result = validateDAG(graph);

    // No edges means the "no source" check doesn't trigger
    expect(result.isValid).toBe(true);
  });
});

// ===========================================================================
// validateDAG — Failure
// ===========================================================================

describe("GraphParser — validateDAG failure", () => {
  it("rejects graph with no Client or sourceRps source", () => {
    const elements = [
      createMockElement("lb", "rectangle", { componentType: "Load Balancer" }),
      createMockElement("s", "rectangle", { componentType: "App Server" }),
      createMockArrow("a1", "lb", "s"),
    ] as unknown as ExcalidrawElement[];

    const graph = parseGraph(elements);
    const result = validateDAG(graph);

    expect(result.isValid).toBe(false);
    expect(result.error).toContain("No 'Client' or load-generating node found");
  });

  it("rejects graph with connected untyped components", () => {
    const elements = [
      createMockElement("c", "rectangle", { componentType: "Client" }),
      createMockElement("untyped", "rectangle", {}), // no componentType
      createMockArrow("a1", "c", "untyped"),
    ] as unknown as ExcalidrawElement[];

    const graph = parseGraph(elements);
    const result = validateDAG(graph);

    expect(result.isValid).toBe(false);
    expect(result.error).toContain("missing a type");
    expect(result.errorNodes).toContain("untyped");
  });

  it("rejects cyclic graph", () => {
    const elements = [
      createMockElement("a", "rectangle", { componentType: "Client" }),
      createMockElement("b", "rectangle", { componentType: "App Server" }),
      createMockElement("c", "rectangle", { componentType: "Database" }),
      createMockArrow("e1", "a", "b"),
      createMockArrow("e2", "b", "c"),
      createMockArrow("e3", "c", "b"), // cycle
    ] as unknown as ExcalidrawElement[];

    const graph = parseGraph(elements);
    const result = validateDAG(graph);

    expect(result.isValid).toBe(false);
    expect(result.error).toContain("Cyclic flow detected");
    expect(result.errorNodes).toBeDefined();
  });

  it("rejects graph with multiple untyped connected nodes", () => {
    const elements = [
      createMockElement("c", "rectangle", { componentType: "Client" }),
      createMockElement("u1", "rectangle", {}),
      createMockElement("u2", "rectangle", {}),
      createMockArrow("a1", "c", "u1"),
      createMockArrow("a2", "u1", "u2"),
    ] as unknown as ExcalidrawElement[];

    const graph = parseGraph(elements);
    const result = validateDAG(graph);

    expect(result.isValid).toBe(false);
    expect(result.error).toContain("2 connected component(s)");
  });
});
