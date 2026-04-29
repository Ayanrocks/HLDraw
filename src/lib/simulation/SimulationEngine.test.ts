import { describe, it, expect } from 'vitest';
import { computeSimulationFrame, NodeMetrics } from './SimulationEngine';
import { GraphNode, GraphEdge, Graph } from './GraphParser';

describe('SimulationEngine', () => {
  it('should correctly process traffic within capacity', () => {
    const nodes = new Map<string, GraphNode>();
    nodes.set('client', { id: 'client', element: {} as any, incomingEdges: [], outgoingEdges: ['edge1'], customData: { componentType: 'Client' } });
    nodes.set('server', { id: 'server', element: {} as any, incomingEdges: ['edge1'], outgoingEdges: [], customData: { componentType: 'App Server', maxCapacity: 1000 } });

    const edges = new Map<string, GraphEdge>();
    edges.set('edge1', { id: 'edge1', sourceId: 'client', targetId: 'server', element: {} as any });

    const graph: Graph = { nodes, edges };
    const topologicalOrder = ['client', 'server'];

    const result = computeSimulationFrame(graph, topologicalOrder, 500);

    expect(result['client']).toBeDefined();
    expect(result['client'].incoming).toBe(500);
    expect(result['client'].processed).toBe(500);
    
    expect(result['server']).toBeDefined();
    expect(result['server'].incoming).toBe(500);
    expect(result['server'].processed).toBe(500);
    expect(result['server'].dropped).toBe(0);
  });

  it('should handle undefined capacities gracefully (no drops)', () => {
    const nodes = new Map<string, GraphNode>();
    nodes.set('client', { id: 'client', element: {} as any, incomingEdges: [], outgoingEdges: ['edge1'], customData: { componentType: 'Client' } });
    nodes.set('server', { id: 'server', element: {} as any, incomingEdges: ['edge1'], outgoingEdges: [], customData: { componentType: 'App Server' } });

    const edges = new Map<string, GraphEdge>();
    edges.set('edge1', { id: 'edge1', sourceId: 'client', targetId: 'server', element: {} as any });

    const graph: Graph = { nodes, edges };
    const topologicalOrder = ['client', 'server'];

    const result = computeSimulationFrame(graph, topologicalOrder, 5000);

    expect(result['server'].incoming).toBe(5000);
    expect(result['server'].processed).toBe(5000);
    expect(result['server'].dropped).toBe(0);
  });

  it('should correctly compute dropped traffic when exceeding capacity', () => {
    const nodes = new Map<string, GraphNode>();
    nodes.set('client', { id: 'client', element: {} as any, incomingEdges: [], outgoingEdges: ['edge1'], customData: { componentType: 'Client' } });
    nodes.set('server', { id: 'server', element: {} as any, incomingEdges: ['edge1'], outgoingEdges: [], customData: { componentType: 'App Server', maxCapacity: 1000 } });

    const edges = new Map<string, GraphEdge>();
    edges.set('edge1', { id: 'edge1', sourceId: 'client', targetId: 'server', element: {} as any });

    const graph: Graph = { nodes, edges };
    const topologicalOrder = ['client', 'server'];

    const result = computeSimulationFrame(graph, topologicalOrder, 1500);

    expect(result['server'].incoming).toBe(1500);
    expect(result['server'].processed).toBe(1000);
    expect(result['server'].dropped).toBe(500);
  });

  it('should cascade dropped traffic (components only forward processed traffic)', () => {
    const nodes = new Map<string, GraphNode>();
    nodes.set('client', { id: 'client', element: {} as any, incomingEdges: [], outgoingEdges: ['edge1'], customData: { componentType: 'Client' } });
    nodes.set('alb', { id: 'alb', element: {} as any, incomingEdges: ['edge1'], outgoingEdges: ['edge2'], customData: { componentType: 'ALB', maxCapacity: 2000 } });
    nodes.set('server', { id: 'server', element: {} as any, incomingEdges: ['edge2'], outgoingEdges: [], customData: { componentType: 'App Server', maxCapacity: 3000 } });

    const edges = new Map<string, GraphEdge>();
    edges.set('edge1', { id: 'edge1', sourceId: 'client', targetId: 'alb', element: {} as any });
    edges.set('edge2', { id: 'edge2', sourceId: 'alb', targetId: 'server', element: {} as any });

    const graph: Graph = { nodes, edges };
    const topologicalOrder = ['client', 'alb', 'server'];

    const result = computeSimulationFrame(graph, topologicalOrder, 2500);

    expect(result['alb'].incoming).toBe(2500);
    expect(result['alb'].processed).toBe(2000);
    expect(result['alb'].dropped).toBe(500);

    expect(result['server'].incoming).toBe(2000);
    expect(result['server'].processed).toBe(2000);
    expect(result['server'].dropped).toBe(0);
  });

  it('should handle multiple target distribution (ALB behavior)', () => {
    const nodes = new Map<string, GraphNode>();
    nodes.set('client', { id: 'client', element: {} as any, incomingEdges: [], outgoingEdges: ['edge1'], customData: { componentType: 'Client' } });
    nodes.set('alb', { id: 'alb', element: {} as any, incomingEdges: ['edge1'], outgoingEdges: ['edge2', 'edge3'], customData: { componentType: 'ALB', maxCapacity: 2000 } });
    nodes.set('server1', { id: 'server1', element: {} as any, incomingEdges: ['edge2'], outgoingEdges: [], customData: { componentType: 'App Server', maxCapacity: 1000 } });
    nodes.set('server2', { id: 'server2', element: {} as any, incomingEdges: ['edge3'], outgoingEdges: [], customData: { componentType: 'App Server', maxCapacity: 1000 } });

    const edges = new Map<string, GraphEdge>();
    edges.set('edge1', { id: 'edge1', sourceId: 'client', targetId: 'alb', element: {} as any });
    edges.set('edge2', { id: 'edge2', sourceId: 'alb', targetId: 'server1', element: {} as any });
    edges.set('edge3', { id: 'edge3', sourceId: 'alb', targetId: 'server2', element: {} as any });

    const graph: Graph = { nodes, edges };
    const topologicalOrder = ['client', 'alb', 'server1', 'server2'];

    const result = computeSimulationFrame(graph, topologicalOrder, 2000);

    expect(result['alb'].processed).toBe(2000);
    expect(result['server1'].incoming).toBe(1000);
    expect(result['server2'].incoming).toBe(1000);
  });

  it('should handle null or invalid component type gracefully', () => {
    const nodes = new Map<string, GraphNode>();
    nodes.set('client', { id: 'client', element: {} as any, incomingEdges: [], outgoingEdges: ['edge1'], customData: { componentType: 'Client' } });
    nodes.set('unknown', { id: 'unknown', element: {} as any, incomingEdges: ['edge1'], outgoingEdges: [], customData: {} });

    const edges = new Map<string, GraphEdge>();
    edges.set('edge1', { id: 'edge1', sourceId: 'client', targetId: 'unknown', element: {} as any });

    const graph: Graph = { nodes, edges };
    const topologicalOrder = ['client', 'unknown'];

    const result = computeSimulationFrame(graph, topologicalOrder, 500);

    expect(result['unknown'].incoming).toBe(500);
    expect(result['unknown'].processed).toBe(500);
    expect(result['unknown'].dropped).toBe(0);
  });
});
