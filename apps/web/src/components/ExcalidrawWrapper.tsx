import React from "react";
import { Excalidraw } from "@excalidraw/excalidraw";
import "@excalidraw/excalidraw/index.css";
import type { ExcalidrawElement, ExcalidrawTextElement, ExcalidrawArrowElement } from "@excalidraw/excalidraw/element/types";
import type { AppState, ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";

interface ExcalidrawWrapperProps {
  setElements: (elements: readonly ExcalidrawElement[]) => void;
  setSelectedElements: (elements: readonly ExcalidrawElement[]) => void;
  setExcalidrawAPI: (api: ExcalidrawImperativeAPI | null) => void;
  setAppState?: (appState: Partial<AppState>) => void;
  initialData: { elements?: readonly ExcalidrawElement[], appState?: Partial<AppState> } | null;
}

const UI_OPTIONS = {
  canvasActions: {
    changeViewBackgroundColor: true,
    clearCanvas: true,
    loadScene: false,
    saveToActiveFile: false,
    toggleTheme: true,
    saveAsImage: true,
  },
};

const isPointInShape = (px: number, py: number, shape: ExcalidrawElement) => {
  const MARGIN = 10;
  
  if (shape.angle) {
    const cx = shape.x + shape.width / 2;
    const cy = shape.y + shape.height / 2;
    const cos = Math.cos(-shape.angle);
    const sin = Math.sin(-shape.angle);
    const dx = px - cx;
    const dy = py - cy;
    px = cx + (dx * cos - dy * sin);
    py = cy + (dx * sin + dy * cos);
  }

  return px >= shape.x - MARGIN && 
         px <= shape.x + shape.width + MARGIN && 
         py >= shape.y - MARGIN && 
         py <= shape.y + shape.height + MARGIN;
};

const ExcalidrawWrapper = React.memo(function ExcalidrawWrapper({
  setElements,
  setSelectedElements,
  setExcalidrawAPI,
  setAppState,
  initialData,
}: ExcalidrawWrapperProps) {
  const prevElementsRef = React.useRef<readonly ExcalidrawElement[]>([]);
  const apiRef = React.useRef<ExcalidrawImperativeAPI | null>(null);

  // Initialize prevElementsRef once when initialData is loaded
  React.useEffect(() => {
    if (initialData?.elements) {
      prevElementsRef.current = initialData.elements;
    }
  }, [initialData]);

  const handleExcalidrawAPI = React.useCallback((api: ExcalidrawImperativeAPI | null) => {
    if (api) {
      apiRef.current = api;
      setExcalidrawAPI(api);
    }
  }, [setExcalidrawAPI]);

  const onChange = React.useCallback((
    excalidrawElements: readonly ExcalidrawElement[],
    appState: AppState
  ) => {
    const prevElements = prevElementsRef.current;
    
    // Find newly deleted elements (either not in the new array, or isDeleted is now true)
    const newlyDeletedIds = new Set<string>();
    for (const prev of prevElements) {
      if (!prev.isDeleted) {
        const current = excalidrawElements.find(e => e.id === prev.id);
        if (!current || current.isDeleted) {
          newlyDeletedIds.add(prev.id);
        }
      }
    }

    let needsUpdate = false;
    // Defer array copy until we know a mutation is needed to reduce GC pressure
    let newElementsToUpdate: ExcalidrawElement[] | null = null;

    const getOrCreateMutableElements = (): ExcalidrawElement[] => {
      if (!newElementsToUpdate) {
        newElementsToUpdate = [...excalidrawElements];
      }
      return newElementsToUpdate;
    };

    // Pass 1: Mark text elements and connected arrows as deleted if their parent is deleted
    if (newlyDeletedIds.size > 0) {
      const mutable = getOrCreateMutableElements();
      newElementsToUpdate = mutable.map(el => {
        if (el.isDeleted) return el;
        
        // Delete bound text when its container is deleted
        if (el.type === "text") {
          const textEl = el as unknown as ExcalidrawTextElement;
          if (textEl.containerId && newlyDeletedIds.has(textEl.containerId)) {
            needsUpdate = true;
            return { ...el, isDeleted: true };
          }
        }

        // Delete arrows whose start or end component was deleted
        if (el.type === "arrow") {
          const arrow = el as unknown as ExcalidrawArrowElement;
          const startBound = arrow.startBinding?.elementId;
          const endBound = arrow.endBinding?.elementId;
          if ((startBound && newlyDeletedIds.has(startBound)) ||
              (endBound && newlyDeletedIds.has(endBound))) {
            needsUpdate = true;
            return { ...el, isDeleted: true };
          }
        }
        
        return el;
      });
    }

    // Pass 2: Magnetic functionality for arrows
    const isInteracting = 
      appState.selectedElementsAreBeingDragged || 
      appState.isResizing || 
      appState.isRotating || 
      appState.newElement !== null;

    if (!isInteracting) {
      const sourceElements = newElementsToUpdate ?? excalidrawElements;
      const bindableShapes = sourceElements.filter(el => 
        !el.isDeleted && 
        el.type !== "arrow" && el.type !== "text" && el.type !== "freedraw" && el.type !== "line"
      );

      const mapped = sourceElements.map(el => {
        if (el.isDeleted || el.type !== "arrow") return el;
        
        const arrow = el as unknown as ExcalidrawArrowElement;
        const points = arrow.points;
        if (!points || points.length < 2) return el;

        const startX = arrow.x + points[0][0];
        const startY = arrow.y + points[0][1];
        
        const lastIdx = points.length - 1;
        const endX = arrow.x + points[lastIdx][0];
        const endY = arrow.y + points[lastIdx][1];

        let changed = false;
        let newStartBinding = arrow.startBinding;
        let newEndBinding = arrow.endBinding;

        // Handle explicitly deleted endpoints (clean up bindings to deleted shapes)
        if (newStartBinding?.elementId && newlyDeletedIds.has(newStartBinding.elementId)) {
          newStartBinding = null;
          changed = true;
        }
        if (newEndBinding?.elementId && newlyDeletedIds.has(newEndBinding.elementId)) {
          newEndBinding = null;
          changed = true;
        }

        // Magnetic snap: if an endpoint is unbound, check if it lies within a bindable shape
        if (!newStartBinding) {
          const shape = bindableShapes.find(s => isPointInShape(startX, startY, s));
          if (shape && shape.id !== arrow.id) {
            newStartBinding = { elementId: shape.id } as any; // removed focus and gap to let excalidraw default
            changed = true;
          }
        }

        if (!newEndBinding) {
          const shape = bindableShapes.find(s => isPointInShape(endX, endY, s));
          if (shape && shape.id !== arrow.id) {
            newEndBinding = { elementId: shape.id } as any;
            changed = true;
          }
        }

        if (changed) {
          needsUpdate = true;
          return {
            ...el,
            startBinding: newStartBinding,
            endBinding: newEndBinding
          } as unknown as ExcalidrawElement;
        }
        
        return el;
      });

      if (needsUpdate) {
        newElementsToUpdate = mapped as ExcalidrawElement[];
      }
    }

    if (needsUpdate && apiRef.current && newElementsToUpdate) {
      // Update scene to mark relationships and text as deleted too
      apiRef.current.updateScene({ elements: newElementsToUpdate });
      return; // Wait for the subsequent onChange to update state
    }

    prevElementsRef.current = excalidrawElements;
    setElements(excalidrawElements);
    
    // Extract selected elements
    const selectedIds = Object.keys(appState.selectedElementIds || {}).filter(
      id => appState.selectedElementIds[id]
    );
    const selected = excalidrawElements.filter(el => selectedIds.includes(el.id) && !el.isDeleted);
    setSelectedElements(selected);

    if (setAppState) {
      setAppState({
        theme: appState.theme,
        viewBackgroundColor: appState.viewBackgroundColor,
      });
    }
  }, [setElements, setSelectedElements, setAppState]);

  return (
    <div className="absolute inset-0">
      <Excalidraw
        onChange={onChange}
        UIOptions={UI_OPTIONS}
        onExcalidrawAPI={handleExcalidrawAPI}
        initialData={initialData}
      />
    </div>
  );
});

export default ExcalidrawWrapper;
