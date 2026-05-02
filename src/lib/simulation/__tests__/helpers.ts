/**
 * Shared test factories for the simulation engine test suite.
 *
 * Eliminates repetitive Map construction boilerplate across tests.
 */
import type { Graph, GraphNode, GraphEdge } from "../GraphParser";
import type { ComponentCustomData } from "../types";

/**
 * Creates a minimal GraphNode for testing.
 * Element is stubbed since the engine only reads customData.
 */
export function createNode(
  id: string,
  customData: ComponentCustomData,
  overrides?: Partial<Pick<GraphNode, "incomingEdges" | "outgoingEdges">>
): GraphNode {
  return {
    id,
    element: {} as GraphNode["element"],
    incomingEdges: overrides?.incomingEdges ?? [],
    outgoingEdges: overrides?.outgoingEdges ?? [],
    customData,
  };
}

/**
 * Creates a minimal GraphEdge for testing.
 */
export function createEdge(
  id: string,
  sourceId: string,
  targetId: string
): GraphEdge {
  return {
    id,
    sourceId,
    targetId,
    element: {} as GraphEdge["element"],
  };
}

/**
 * Builds a complete Graph from arrays of nodes and edges,
 * wiring incoming/outgoing edge references automatically.
 */
export function buildGraph(
  nodeDefs: { id: string; customData: ComponentCustomData }[],
  edgeDefs: { id: string; sourceId: string; targetId: string }[]
): Graph {
  const nodes = new Map<string, GraphNode>();
  const edges = new Map<string, GraphEdge>();

  for (const def of nodeDefs) {
    nodes.set(def.id, createNode(def.id, def.customData));
  }

  for (const def of edgeDefs) {
    const edge = createEdge(def.id, def.sourceId, def.targetId);
    edges.set(def.id, edge);

    const source = nodes.get(def.sourceId);
    const target = nodes.get(def.targetId);

    if (source) source.outgoingEdges.push(def.id);
    if (target) target.incomingEdges.push(def.id);
  }

  return { nodes, edges };
}

/**
 * Creates a mock ExcalidrawElement for GraphParser tests.
 */
export function createMockElement(
  id: string,
  type: string,
  customData: ComponentCustomData = {},
  overrides: Record<string, unknown> = {}
): Record<string, unknown> {
  return {
    id,
    type,
    customData,
    isDeleted: false,
    groupIds: [],
    ...overrides,
  };
}

/**
 * Creates a mock ExcalidrawArrowElement for GraphParser tests.
 */
export function createMockArrow(
  id: string,
  sourceElementId: string | null,
  targetElementId: string | null,
  overrides: Record<string, unknown> = {}
): Record<string, unknown> {
  return {
    id,
    type: "arrow",
    isDeleted: false,
    groupIds: [],
    customData: {},
    startBinding: sourceElementId ? { elementId: sourceElementId } : null,
    endBinding: targetElementId ? { elementId: targetElementId } : null,
    ...overrides,
  };
}
