"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import dynamic from "next/dynamic";
import { get, set } from "idb-keyval";
import TopBar from "@/components/TopBar";
import type { ExcalidrawElement } from "@excalidraw/excalidraw/element/types";

import { parseGraph, validateDAG } from "@/lib/simulation/GraphParser";
import { useSimulation } from "@/lib/simulation/useSimulation";
import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";

import TrafficOverlay from "@/components/TrafficOverlay";
import { startCleanupService, stopCleanupService } from "@/lib/cache/CacheCleanupService";

/** Debounce interval (ms) for persisting elements/appState to IndexedDB */
const DEBOUNCE_TIMEOUT_MS = 500;

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

  // Snapshot of element IDs when simulation starts — used to detect structural modifications
  const simulationSnapshotRef = useRef<Set<string> | null>(null);

  // Excalidraw API and Persistence state
  const [excalidrawAPI, setExcalidrawAPI] = useState<ExcalidrawImperativeAPI | null>(null);
  
  const { metrics } = useSimulation(isSimulating, elements, globalRps, excalidrawAPI);

  const [initialData, setInitialData] = useState<{ elements?: readonly ExcalidrawElement[], appState?: any } | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  const [appState, setAppState] = useState<any>(null);

  // --- Cache cleanup lifecycle ---
  useEffect(() => {
    startCleanupService();
    return () => stopCleanupService();
  }, []);

  useEffect(() => {
    Promise.all([
      get("hlDraw-elements"),
      get("hlDraw-appState")
    ]).then(([storedElements, storedAppState]) => {
      let safeElements: ExcalidrawElement[] = [];
      if (storedElements && Array.isArray(storedElements)) {
        // Sanitize corrupted elements that might have infinite/NaN bounds
        // Also strip deleted elements to prevent IndexedDB bloat
        safeElements = storedElements.filter(el =>
          el &&
          !el.isDeleted &&
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

  // --- Debounced persistence to IndexedDB ---
  // Prevents writes on every keystroke/drag — waits 500ms of inactivity.
  const persistTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const persistElements = useCallback((els: readonly ExcalidrawElement[]) => {
    // Strip deleted elements before persisting to save space
    const liveElements = els.filter(el => !el.isDeleted);
    set("hlDraw-elements", liveElements).catch(console.error);
  }, []);

  useEffect(() => {
    if (!isLoaded) return;

    if (persistTimerRef.current) {
      clearTimeout(persistTimerRef.current);
    }

    persistTimerRef.current = setTimeout(() => {
      persistElements(elements);
    }, DEBOUNCE_TIMEOUT_MS);

    return () => {
      if (persistTimerRef.current) {
        clearTimeout(persistTimerRef.current);
      }
    };
  }, [elements, isLoaded, persistElements]);

  // Save appState whenever it changes (debounced)
  const appStatePersistTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!isLoaded || !appState) return;

    if (appStatePersistTimerRef.current) {
      clearTimeout(appStatePersistTimerRef.current);
    }

    appStatePersistTimerRef.current = setTimeout(() => {
      set("hlDraw-appState", appState).catch(console.error);
    }, DEBOUNCE_TIMEOUT_MS);

    return () => {
      if (appStatePersistTimerRef.current) {
        clearTimeout(appStatePersistTimerRef.current);
      }
    };
  }, [appState, isLoaded]);

  // Auto-stop simulation when structural changes are detected on the canvas
  useEffect(() => {
    if (!isSimulating || !simulationSnapshotRef.current) return;

    const snapshot = simulationSnapshotRef.current;
    const currentIds = new Set(
      elements.filter(el => !el.isDeleted).map(el => el.id)
    );

    // Detect added or removed elements
    const hasAdded = [...currentIds].some(id => !snapshot.has(id));
    const hasRemoved = [...snapshot].some(id => !currentIds.has(id));

    if (hasAdded || hasRemoved) {
      setIsSimulating(false);
    }
  }, [isSimulating, elements]);

  // When simulation starts, validate DAG and take element snapshot
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
        simulationSnapshotRef.current = null;
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
        // Take a snapshot of current element IDs for structural change detection
        simulationSnapshotRef.current = new Set(
          elements.filter(el => !el.isDeleted).map(el => el.id)
        );
      }
    } else {
      setSimulationError(null);
      simulationSnapshotRef.current = null;
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
