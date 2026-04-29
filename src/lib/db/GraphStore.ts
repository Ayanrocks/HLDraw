import { get, set, del } from "idb-keyval";
import type { Graph } from "../simulation/GraphParser";

const GRAPH_STORE_PREFIX = "hlDraw-graph-";

export async function addGraph(graphId: string, graph: Graph): Promise<void> {
  const existing = await getGraph(graphId);
  if (existing) {
    throw new Error(`Graph with ID ${graphId} already exists`);
  }
  await set(`${GRAPH_STORE_PREFIX}${graphId}`, graph);
}

export async function updateGraph(graphId: string, graph: Graph): Promise<void> {
  // Can just overwrite, but let's check if it exists conceptually
  const existing = await getGraph(graphId);
  if (!existing) {
    throw new Error(`Graph with ID ${graphId} does not exist`);
  }
  await set(`${GRAPH_STORE_PREFIX}${graphId}`, graph);
}

export async function saveOrUpdateGraph(graphId: string, graph: Graph): Promise<void> {
  await set(`${GRAPH_STORE_PREFIX}${graphId}`, graph);
}

export async function getGraph(graphId: string): Promise<Graph | undefined> {
  return await get<Graph>(`${GRAPH_STORE_PREFIX}${graphId}`);
}

export async function deleteGraph(graphId: string): Promise<void> {
  await del(`${GRAPH_STORE_PREFIX}${graphId}`);
}
