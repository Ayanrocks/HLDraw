import type { ExcalidrawElement, ExcalidrawArrowElement } from "@excalidraw/excalidraw/element/types";

export interface GraphNode {
  id: string;
  element: ExcalidrawElement;
  incomingEdges: string[]; // IDs of arrow elements
  outgoingEdges: string[]; // IDs of arrow elements
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  customData: any;
}

export interface GraphEdge {
  id: string;
  sourceId: string;
  targetId: string;
  element: ExcalidrawArrowElement;
}

export interface Graph {
  nodes: Map<string, GraphNode>;
  edges: Map<string, GraphEdge>;
}

export function parseGraph(elements: readonly ExcalidrawElement[]): Graph {
  const nodes = new Map<string, GraphNode>();
  const edges = new Map<string, GraphEdge>();

  // First pass: Identify all potential nodes (elements that can be bound to)
  for (const el of elements) {
    if (el.type !== "arrow" && el.type !== "line" && el.type !== "freedraw" && el.type !== "text") {
      nodes.set(el.id, {
        id: el.id,
        element: el,
        incomingEdges: [],
        outgoingEdges: [],
        customData: el.customData || {},
      });
    }
  }

  // Second pass: Process arrows to build edges
  for (const el of elements) {
    if (el.type === "arrow") {
      const arrow = el as ExcalidrawArrowElement;
      
      const sourceId = arrow.startBinding?.elementId;
      const targetId = arrow.endBinding?.elementId;

      if (sourceId && targetId && nodes.has(sourceId) && nodes.has(targetId)) {
        edges.set(arrow.id, {
          id: arrow.id,
          sourceId,
          targetId,
          element: arrow,
        });

        nodes.get(sourceId)!.outgoingEdges.push(arrow.id);
        nodes.get(targetId)!.incomingEdges.push(arrow.id);
      }
    }
  }

  // Filter out nodes that have no connections AND are not designated components?
  // We'll keep them for now, but in simulation we only care about connected components starting from "Client"

  return { nodes, edges };
}

export function validateDAG(graph: Graph): { isValid: boolean; error?: string } {
  // Cycle detection using Depth First Search
  const visited = new Set<string>();
  const recursionStack = new Set<string>();

  for (const [nodeId] of graph.nodes) {
    if (!visited.has(nodeId)) {
      if (detectCycle(nodeId, graph, visited, recursionStack)) {
        return { 
          isValid: false, 
          error: "Cyclic flow detected in the architecture. Phase 1 only supports Directed Acyclic Graphs (DAG)." 
        };
      }
    }
  }

  // Check if there's at least one Client node
  let hasClient = false;
  for (const node of graph.nodes.values()) {
    if (node.customData.componentType === "Client") {
      hasClient = true;
      break;
    }
  }

  if (!hasClient && graph.nodes.size > 0 && graph.edges.size > 0) {
    return {
      isValid: false,
      error: "No 'Client' node found. The simulation requires at least one Client to generate load."
    };
  }

  return { isValid: true };
}

function detectCycle(
  nodeId: string, 
  graph: Graph, 
  visited: Set<string>, 
  recursionStack: Set<string>
): boolean {
  visited.add(nodeId);
  recursionStack.add(nodeId);

  const node = graph.nodes.get(nodeId);
  if (node) {
    for (const edgeId of node.outgoingEdges) {
      const edge = graph.edges.get(edgeId);
      if (edge) {
        const targetId = edge.targetId;
        if (!visited.has(targetId) && detectCycle(targetId, graph, visited, recursionStack)) {
          return true;
        } else if (recursionStack.has(targetId)) {
          return true;
        }
      }
    }
  }

  recursionStack.delete(nodeId);
  return false;
}
