import { describe, it, expect } from 'vitest';
import { parseGraph, validateDAG } from './GraphParser';
import type { ExcalidrawElement, ExcalidrawArrowElement } from "@excalidraw/excalidraw/element/types";

describe('GraphParser', () => {
  it('should parse basic nodes without connections', () => {
    const elements: ExcalidrawElement[] = [
      { id: 'node1', type: 'rectangle', customData: { componentType: 'Client' } } as unknown as ExcalidrawElement,
      { id: 'node2', type: 'diamond', customData: { componentType: 'DB' } } as unknown as ExcalidrawElement,
    ];

    const graph = parseGraph(elements);

    expect(graph.nodes.size).toBe(2);
    expect(graph.edges.size).toBe(0);
    expect(graph.nodes.get('node1')?.customData.componentType).toBe('Client');
  });

  it('should parse arrows into edges and connect incoming/outgoing links', () => {
    const elements: ExcalidrawElement[] = [
      { id: 'client1', type: 'rectangle', customData: { componentType: 'Client' } } as unknown as ExcalidrawElement,
      { id: 'server1', type: 'rectangle', customData: { componentType: 'App Server' } } as unknown as ExcalidrawElement,
      {
        id: 'arrow1',
        type: 'arrow',
        startBinding: { elementId: 'client1' },
        endBinding: { elementId: 'server1' },
      } as unknown as ExcalidrawArrowElement,
    ];

    const graph = parseGraph(elements);

    expect(graph.nodes.size).toBe(2);
    expect(graph.edges.size).toBe(1);

    const edge = graph.edges.get('arrow1');
    expect(edge).toBeDefined();
    expect(edge?.sourceId).toBe('client1');
    expect(edge?.targetId).toBe('server1');

    const clientNode = graph.nodes.get('client1');
    expect(clientNode?.outgoingEdges).toContain('arrow1');
    expect(clientNode?.incomingEdges.length).toBe(0);

    const serverNode = graph.nodes.get('server1');
    expect(serverNode?.incomingEdges).toContain('arrow1');
    expect(serverNode?.outgoingEdges.length).toBe(0);
  });

  it('should ignore disconnected arrows', () => {
    const elements: ExcalidrawElement[] = [
      { id: 'client1', type: 'rectangle', customData: { componentType: 'Client' } } as unknown as ExcalidrawElement,
      {
        id: 'arrow_dangling',
        type: 'arrow',
        startBinding: { elementId: 'client1' },
        endBinding: null,
      } as unknown as ExcalidrawArrowElement,
    ];

    const graph = parseGraph(elements);

    expect(graph.nodes.size).toBe(1);
    expect(graph.edges.size).toBe(0);
    expect(graph.nodes.get('client1')?.outgoingEdges.length).toBe(0);
  });
});

describe('DAG Validation', () => {
  it('should return isValid for a proper DAG with a Client', () => {
    const elements: ExcalidrawElement[] = [
      { id: 'client1', type: 'rectangle', customData: { componentType: 'Client' } } as unknown as ExcalidrawElement,
      { id: 'alb1', type: 'rectangle', customData: { componentType: 'ALB' } } as unknown as ExcalidrawElement,
      { id: 'server1', type: 'rectangle', customData: { componentType: 'App Server' } } as unknown as ExcalidrawElement,
      {
        id: 'arrow1', type: 'arrow', startBinding: { elementId: 'client1' }, endBinding: { elementId: 'alb1' },
      } as unknown as ExcalidrawArrowElement,
      {
        id: 'arrow2', type: 'arrow', startBinding: { elementId: 'alb1' }, endBinding: { elementId: 'server1' },
      } as unknown as ExcalidrawArrowElement,
    ];

    const graph = parseGraph(elements);
    const result = validateDAG(graph);

    expect(result.isValid).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it('should return invalid if there is no Client node', () => {
    const elements: ExcalidrawElement[] = [
      { id: 'alb1', type: 'rectangle', customData: { componentType: 'ALB' } } as unknown as ExcalidrawElement,
      { id: 'server1', type: 'rectangle', customData: { componentType: 'App Server' } } as unknown as ExcalidrawElement,
      {
        id: 'arrow1', type: 'arrow', startBinding: { elementId: 'alb1' }, endBinding: { elementId: 'server1' },
      } as unknown as ExcalidrawArrowElement,
    ];

    const graph = parseGraph(elements);
    const result = validateDAG(graph);

    expect(result.isValid).toBe(false);
    expect(result.error).toContain("No 'Client' or load-generating node found");
  });

  it('should return invalid if a cycle is detected', () => {
    const elements: ExcalidrawElement[] = [
      { id: 'client1', type: 'rectangle', customData: { componentType: 'Client' } } as unknown as ExcalidrawElement,
      { id: 'server1', type: 'rectangle', customData: { componentType: 'App Server' } } as unknown as ExcalidrawElement,
      { id: 'db1', type: 'rectangle', customData: { componentType: 'DB' } } as unknown as ExcalidrawElement,
      { id: 'a1', type: 'arrow', startBinding: { elementId: 'client1' }, endBinding: { elementId: 'server1' } } as unknown as ExcalidrawArrowElement,
      { id: 'a2', type: 'arrow', startBinding: { elementId: 'server1' }, endBinding: { elementId: 'db1' } } as unknown as ExcalidrawArrowElement,
      // Cycle edge: DB back to Server
      { id: 'a3', type: 'arrow', startBinding: { elementId: 'db1' }, endBinding: { elementId: 'server1' } } as unknown as ExcalidrawArrowElement,
    ];

    const graph = parseGraph(elements);
    const result = validateDAG(graph);

    expect(result.isValid).toBe(false);
    expect(result.error).toContain('Cyclic flow detected');
  });
});
