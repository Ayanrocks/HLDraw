import type { ExcalidrawElement, ExcalidrawArrowElement } from "@excalidraw/excalidraw/element/types";
import type { ComponentCustomData } from "./types";

export interface GraphNode {
  id: string;
  element: ExcalidrawElement;
  incomingEdges: string[]; // IDs of arrow elements
  outgoingEdges: string[]; // IDs of arrow elements
  customData: ComponentCustomData;
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
    if (el.isDeleted) continue;
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
    if (el.isDeleted) continue;
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

export function getTopologicalOrder(graph: Graph): { order: string[]; error?: string; errorNodes?: string[] } {
  // Kahn's algorithm for Topological Sorting and Cycle Detection
  const inDegree = new Map<string, number>();
  const queue: string[] = [];
  const order: string[] = [];

  // Initialize in-degrees
  for (const [nodeId, node] of graph.nodes) {
    inDegree.set(nodeId, node.incomingEdges.length);
    if (node.incomingEdges.length === 0) {
      queue.push(nodeId);
    }
  }

  while (queue.length > 0) {
    const currentId = queue.shift()!;
    order.push(currentId);

    const node = graph.nodes.get(currentId);
    if (node) {
      for (const edgeId of node.outgoingEdges) {
        const edge = graph.edges.get(edgeId);
        if (edge) {
          const targetId = edge.targetId;
          const currentInDegree = inDegree.get(targetId) || 0;
          inDegree.set(targetId, currentInDegree - 1);
          if (currentInDegree - 1 === 0) {
            queue.push(targetId);
          }
        }
      }
    }
  }

  if (order.length !== graph.nodes.size) {
    const cyclicNodes = Array.from(inDegree.entries())
      .filter(([_, degree]) => degree > 0)
      .map(([id]) => id);
    return { order: [], error: "Cyclic flow detected in the architecture. Phase 1 only supports Directed Acyclic Graphs (DAG).", errorNodes: cyclicNodes };
  }

  return { order };
}

export function validateDAG(graph: Graph): { isValid: boolean; error?: string; topologicalOrder?: string[]; errorNodes?: string[] } {
  // Check for untyped components first
  const untypedNodes: string[] = [];
  for (const [nodeId, node] of graph.nodes) {
    if (!node.customData.componentType) {
      untypedNodes.push(nodeId);
    }
  }

  if (untypedNodes.length > 0) {
    return {
      isValid: false,
      error: "Some components are missing a type. Please select a type for them.",
      errorNodes: untypedNodes
    };
  }

  const { order, error, errorNodes } = getTopologicalOrder(graph);

  if (error) {
    return { 
      isValid: false, 
      error,
      errorNodes
    };
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

  return { isValid: true, topologicalOrder: order };
}
