import type { ExcalidrawElement, ExcalidrawArrowElement } from "@excalidraw/excalidraw/element/types";
import type { ComponentCustomData } from "./types";
import { isClientType } from "./ComponentRegistry";

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

  // Mapping from individual element ID to logical node ID
  const elementToNodeId = new Map<string, string>();

  // First pass: Group elements and identify logical nodes
  for (const el of elements) {
    if (el.isDeleted) continue;
    
    // Skip text, connectors, and elements bound to a container (labels)
    if (el.type === "arrow" || el.type === "line" || el.type === "freedraw" || el.type === "text") continue;
    const textEl = el as unknown as { containerId?: string };
    if (textEl.containerId) continue;

    {
      // Determine logical node ID (top-most group ID or element ID)
      const logicalNodeId = el.groupIds && el.groupIds.length > 0 
        ? el.groupIds[el.groupIds.length - 1] 
        : el.id;
        
      elementToNodeId.set(el.id, logicalNodeId);

      if (!nodes.has(logicalNodeId)) {
        nodes.set(logicalNodeId, {
          id: logicalNodeId,
          element: el, // Keep the first element as representative
          incomingEdges: [],
          outgoingEdges: [],
          customData: el.customData || {},
        });
      } else {
        // Merge customData in case it was stored on a different shape in the group
        const existingNode = nodes.get(logicalNodeId)!;
        if (Object.keys(el.customData || {}).length > 0) {
          existingNode.customData = {
            ...existingNode.customData,
            ...el.customData
          };
        }
      }
    }
  }

  // Second pass: Process arrows to build edges
  for (const el of elements) {
    if (el.isDeleted) continue;
    if (el.type === "arrow") {
      const arrow = el as ExcalidrawArrowElement;
      
      const rawSourceId = arrow.startBinding?.elementId;
      const rawTargetId = arrow.endBinding?.elementId;

      const sourceId = rawSourceId ? elementToNodeId.get(rawSourceId) : undefined;
      const targetId = rawTargetId ? elementToNodeId.get(rawTargetId) : undefined;

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
  // Check for untyped components that are actually connected (have edges)
  // Isolated shapes without type are treated as decorative and ignored
  const untypedNodes: string[] = [];
  for (const [nodeId, node] of graph.nodes) {
    const isConnected = node.incomingEdges.length > 0 || node.outgoingEdges.length > 0;
    if (!node.customData.componentType && isConnected) {
      untypedNodes.push(nodeId);
    }
  }

  if (untypedNodes.length > 0) {
    return {
      isValid: false,
      error: `${untypedNodes.length} connected component(s) are missing a type. Select them and assign a type in the sidebar.`,
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

  // Check if there's at least one Client node or a node with sourceRps
  let hasSource = false;
  for (const node of graph.nodes.values()) {
    if (isClientType(node.customData.componentType || "") || (node.customData.sourceRps && node.customData.sourceRps > 0)) {
      hasSource = true;
      break;
    }
  }

  if (!hasSource && graph.nodes.size > 0 && graph.edges.size > 0) {
    return {
      isValid: false,
      error: "No 'Client' or load-generating node found. The simulation requires at least one Client or a component with 'Source RPS' to generate load."
    };
  }

  return { isValid: true, topologicalOrder: order };
}
