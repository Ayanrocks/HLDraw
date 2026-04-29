"use client";

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { get, set } from "idb-keyval";
import TopBar from "@/components/TopBar";
import Sidebar from "@/components/Sidebar";
import type { ExcalidrawElement } from "@excalidraw/excalidraw/element/types";

import { parseGraph, validateDAG } from "@/lib/simulation/GraphParser";

// Dynamic import for Excalidraw to prevent SSR issues
const ExcalidrawWrapper = dynamic(() => import("@/components/ExcalidrawWrapper"), {
  ssr: false,
  loading: () => <div className="flex flex-1 items-center justify-center bg-[#121212] text-white">Loading Canvas...</div>,
});

export default function Home() {
  const [isSimulating, setIsSimulating] = useState(false);
  const [globalRps, setGlobalRps] = useState(100);
  const [selectedElements, setSelectedElements] = useState<readonly ExcalidrawElement[]>([]);
  const [elements, setElements] = useState<readonly ExcalidrawElement[]>([]);
  const [simulationError, setSimulationError] = useState<string | null>(null);

  // Excalidraw API and Persistence state
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [excalidrawAPI, setExcalidrawAPI] = useState<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [initialData, setInitialData] = useState<any>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load from IndexedDB on mount
  useEffect(() => {
    get("hlDraw-elements").then((storedElements) => {
      let safeElements: any[] = [];
      if (storedElements && Array.isArray(storedElements)) {
        // Sanitize corrupted elements that might have infinite/NaN bounds
        safeElements = storedElements.filter(el =>
          el && typeof el.width === 'number' && typeof el.height === 'number' &&
          !isNaN(el.width) && !isNaN(el.height) &&
          el.width > 0 && el.height > 0 &&
          el.width < 50000 && el.height < 50000
        );
      }

      if (safeElements.length > 0) {
        setInitialData({ elements: safeElements });
        setElements(safeElements);
      } else {
        setInitialData({ elements: [] });
      }
      setIsLoaded(true);
    }).catch(() => {
      // Fallback on error
      setInitialData({ elements: [] });
      setIsLoaded(true);
    });
  }, []);

  // Save to IndexedDB whenever elements change (debounced implicitly by React renders, but good enough)
  useEffect(() => {
    if (isLoaded) {
      set("hlDraw-elements", elements);
    }
  }, [elements, isLoaded]);

  // When simulation starts, validate DAG
  useEffect(() => {
    if (isSimulating) {
      const graph = parseGraph(elements);
      const { isValid, error } = validateDAG(graph);

      if (!isValid) {
        setSimulationError(error || "Invalid Architecture");
        setIsSimulating(false);
      } else {
        setSimulationError(null);
        // Simulation engine tick goes here
      }
    } else {
      setSimulationError(null);
    }
  }, [isSimulating, elements]);

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
            initialData={initialData}
          />
        </main>
        <Sidebar
          elements={elements}
          selectedElements={selectedElements}
          setElements={setElements}
          excalidrawAPI={excalidrawAPI}
        />
      </div>
    </div>
  );
}
