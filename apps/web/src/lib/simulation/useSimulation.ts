import { useEffect, useRef, useState, useCallback } from "react";
import { parseGraph, validateDAG } from "./GraphParser";
import { computeSimulationFrame, NodeMetrics } from "./SimulationEngine";
import type { ExcalidrawElement } from "@excalidraw/excalidraw/element/types";

import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";

/**
 * Custom hook that drives the simulation loop.
 *
 * Key design decisions:
 * - Uses requestAnimationFrame for smooth animation integration.
 * - Throttles React state updates to ~10 fps to avoid render storms.
 * - Re-parses the graph from a ref so element changes (e.g. maxCapacity edits)
 *   are picked up WITHOUT re-running the effect and recreating the rAF loop.
 * - Arrow styling (blue dashed) is applied once on start and reverted on stop.
 */
export function useSimulation(
  isSimulating: boolean,
  elements: readonly ExcalidrawElement[],
  globalRps: number,
  excalidrawAPI: ExcalidrawImperativeAPI | null
) {
  const [metrics, setMetrics] = useState<Record<string, NodeMetrics>>({});
  const animationRef = useRef<number>(0);
  const lastUpdateRef = useRef<number>(0);

  // Keep a mutable ref for values that change frequently so the rAF
  // closure always reads the latest without restarting the loop.
  const elementsRef = useRef(elements);
  const globalRpsRef = useRef(globalRps);

  useEffect(() => {
    elementsRef.current = elements;
    globalRpsRef.current = globalRps;
  }, [elements, globalRps]);

  // Track previous simulation state to handle start/stop transitions
  const prevSimulating = useRef(false);

  const stopAnimation = useCallback(() => {
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = 0;
    }
  }, []);

  useEffect(() => {
    if (!excalidrawAPI) return;

    // --- Simulation STOPPED ---
    if (!isSimulating) {
      stopAnimation();

      // Revert arrow styles when simulation turns off
      if (prevSimulating.current && elements.length > 0) {
        const resetElements = elements.map(el => {
          if (el.type === "arrow" && el.customData?.wasSimulating) {
            return {
              ...el,
              strokeStyle: "solid" as const,
              strokeColor: el.customData.originalColor || "#1e1e1e",
              customData: { ...el.customData, wasSimulating: false }
            };
          }
          return el;
        });

        if (resetElements.some(el => el.customData?.wasSimulating === false)) {
          excalidrawAPI.updateScene({ elements: resetElements });
        }
      }

      prevSimulating.current = false;
      // eslint-disable-next-line react-hooks/exhaustive-deps
      setMetrics({});
      return;
    }

    // --- Simulation STARTED ---
    const graph = parseGraph(elements);
    const { isValid, topologicalOrder } = validateDAG(graph);

    if (!isValid || !topologicalOrder) return;

    // Style arrows blue + dashed once on start
    if (!prevSimulating.current) {
      const activeEdges = Array.from(graph.edges.keys());
      const styledElements = elements.map(el => {
        if (el.type === "arrow" && activeEdges.includes(el.id)) {
          return {
            ...el,
            strokeStyle: "dashed" as const,
            strokeColor: "#3b82f6",
            customData: { ...el.customData, wasSimulating: true, originalColor: el.strokeColor }
          };
        }
        return el;
      });
      excalidrawAPI.updateScene({ elements: styledElements });
      prevSimulating.current = true;
    }

    // Animation loop — reads latest elements + globalRps from refs
    const tick = (now: number) => {
      if (now - lastUpdateRef.current > 100) {
        // Re-parse graph each tick so capacity changes are always picked up
        const freshGraph = parseGraph(elementsRef.current);
        const freshValidation = validateDAG(freshGraph);

        if (freshValidation.isValid && freshValidation.topologicalOrder) {
          const frameMetrics = computeSimulationFrame(
            freshGraph,
            freshValidation.topologicalOrder,
            globalRpsRef.current
          );
          setMetrics(frameMetrics);
        }

        lastUpdateRef.current = now;
      }
      animationRef.current = requestAnimationFrame(tick);
    };

    animationRef.current = requestAnimationFrame(tick);

    return () => stopAnimation();
  }, [isSimulating, excalidrawAPI, stopAnimation]); // eslint-disable-line react-hooks/exhaustive-deps
  // elements and globalRps are read via refs, so they are intentionally omitted.

  return { metrics };
}
