"use client";

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { get, set } from "idb-keyval";
import TopBar from "@/components/TopBar";
import type { ExcalidrawElement } from "@excalidraw/excalidraw/element/types";

import { parseGraph, validateDAG } from "@/lib/simulation/GraphParser";
import { useSimulation } from "@/lib/simulation/useSimulation";
import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";

import TrafficOverlay from "@/components/TrafficOverlay";

// Dynamic import for Excalidraw to prevent SSR issues
const ExcalidrawWrapper = dynamic(() => import("@/components/ExcalidrawWrapper"), {
  ssr: false,
  loading: () => <div className="flex flex-1 items-center justify-center bg-[#121212] text-white">Loading Canvas...</div>,
});

const Sidebar = dynamic(() => import("@/components/Sidebar"), { ssr: false });
const ComponentPalette = dynamic(() => import("@/components/ComponentPalette"), { ssr: false });

export default function Home() {
  const [isSimulating, setIsSimulating] = useState(false);
  const [globalRps, setGlobalRps] = useState(100);
  const [selectedElements, setSelectedElements] = useState<readonly ExcalidrawElement[]>([]);
  const [elements, setElements] = useState<readonly ExcalidrawElement[]>([]);
  const [simulationError, setSimulationError] = useState<string | null>(null);

  // Excalidraw API and Persistence state
  const [excalidrawAPI, setExcalidrawAPI] = useState<ExcalidrawImperativeAPI | null>(null);
  
  const { metrics } = useSimulation(isSimulating, elements, globalRps, excalidrawAPI);

  const [initialData, setInitialData] = useState<{ elements?: readonly ExcalidrawElement[], appState?: any } | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  const [appState, setAppState] = useState<any>(null);

  useEffect(() => {
    Promise.all([
      get("hlDraw-elements"),
      get("hlDraw-appState")
    ]).then(([storedElements, storedAppState]) => {
      let safeElements: ExcalidrawElement[] = [];
      if (storedElements && Array.isArray(storedElements)) {
        // Sanitize corrupted elements that might have infinite/NaN bounds
        safeElements = storedElements.filter(el =>
          el && 
          typeof el.width === 'number' && !isNaN(el.width) && el.width >= 0 && el.width < 50000 &&
          typeof el.height === 'number' && !isNaN(el.height) && el.height >= 0 && el.height < 50000 &&
          typeof el.x === 'number' && !isNaN(el.x) && Math.abs(el.x) < 50000 &&
          typeof el.y === 'number' && !isNaN(el.y) && Math.abs(el.y) < 50000
        );
      }

      const initialAppState = storedAppState || { theme: "dark" };

      if (safeElements.length > 0) {
        setInitialData({ elements: safeElements, appState: initialAppState });
        setElements(safeElements);
      } else {
        setInitialData({ elements: [], appState: initialAppState });
      }
      setIsLoaded(true);
    }).catch(() => {
      // Fallback on error
      setInitialData({ elements: [], appState: { theme: "dark" } });
      setIsLoaded(true);
    });
  }, []);

  // Save to IndexedDB whenever elements change
  useEffect(() => {
    if (isLoaded) {
      set("hlDraw-elements", elements);
      // Also store the pure graph representation in our DB module
      const graph = parseGraph(elements);
      import("@/lib/db/GraphStore").then(({ saveOrUpdateGraph }) => {
        saveOrUpdateGraph("main-graph", graph).catch(console.error);
      });
    }
  }, [elements, isLoaded]);

  // Save appState whenever it changes
  useEffect(() => {
    if (isLoaded && appState) {
      set("hlDraw-appState", appState);
    }
  }, [appState, isLoaded]);

  // When simulation starts, validate DAG
  useEffect(() => {
    if (isSimulating) {
      const graph = parseGraph(elements);
      const { isValid, error, errorNodes } = validateDAG(graph);

      if (!isValid) {
        // Detailed console logging for debugging
        console.error("================ SIMULATION ERROR ================");
        console.error("Error:", error || "Invalid Architecture");
        if (errorNodes) {
          console.error(`Affected Nodes (${errorNodes.length}):`);
          errorNodes.forEach(id => {
            const node = graph.nodes.get(id);
            const el = node?.element;
            console.error(
              `  → [${id}] type=${el?.type ?? "?"}, customData=`,
              node?.customData ?? {},
              `edges: in=${node?.incomingEdges.length ?? 0} out=${node?.outgoingEdges.length ?? 0}`
            );
          });
        }
        console.error("Full Graph:", { nodes: graph.nodes.size, edges: graph.edges.size });
        console.error("==================================================");

        // eslint-disable-next-line react-hooks/exhaustive-deps
        setSimulationError(error || "Invalid Architecture");
        setIsSimulating(false);
        if (errorNodes && errorNodes.length > 0 && excalidrawAPI) {
          const selectedElementIds: Record<string, true> = {};
          
          errorNodes.forEach(id => {
            selectedElementIds[id] = true;
            const nodeEl = elements.find(el => el.id === id);
            
            // If the node is part of a group (like a complex component), select the entire group
            if (nodeEl && nodeEl.groupIds && nodeEl.groupIds.length > 0) {
              elements.forEach(otherEl => {
                if (otherEl.groupIds?.some(gId => nodeEl.groupIds!.includes(gId))) {
                  selectedElementIds[otherEl.id] = true;
                }
              });
            }
            
            // Also select bound text elements if any
            if (nodeEl && nodeEl.boundElements) {
              nodeEl.boundElements.forEach(bound => {
                if (bound.type === "text") {
                  selectedElementIds[bound.id] = true;
                }
              });
            }
          });

          excalidrawAPI.updateScene({ appState: { selectedElementIds } });
        }
      } else {
        setSimulationError(null);
        // Simulation engine tick goes here
      }
    } else {
      setSimulationError(null);
    }
  }, [isSimulating, elements, excalidrawAPI]);

  if (!isLoaded) return null; // Wait for initial load

  return (
    <div className="flex flex-col h-screen bg-[#121212] text-white overflow-hidden font-sans">
      <TopBar
        isSimulating={isSimulating}
        setIsSimulating={setIsSimulating}
        globalRps={globalRps}
        setGlobalRps={setGlobalRps}
        simulationError={simulationError}
      />
      <div className="flex flex-1 overflow-hidden">
        <main className="flex-1 relative border-r border-[#2a2a2a]">
          <ExcalidrawWrapper
            setElements={setElements}
            setSelectedElements={setSelectedElements}
            setExcalidrawAPI={setExcalidrawAPI}
            setAppState={setAppState}
            initialData={initialData}
          />
          <TrafficOverlay
            isSimulating={isSimulating && !simulationError}
            excalidrawAPI={excalidrawAPI}
            metrics={metrics}
          />
          <ComponentPalette
            excalidrawAPI={excalidrawAPI}
            elements={elements}
            setElements={setElements}
          />
        </main>
        <Sidebar
          elements={elements}
          selectedElements={selectedElements}
          setElements={setElements}
          excalidrawAPI={excalidrawAPI}
          metrics={metrics}
        />
      </div>
    </div>
  );
}
