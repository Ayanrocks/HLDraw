import React from "react";
import { Excalidraw } from "@excalidraw/excalidraw";
import "@excalidraw/excalidraw/index.css";
import type { ExcalidrawElement, ExcalidrawTextElement, ExcalidrawArrowElement } from "@excalidraw/excalidraw/element/types";
import type { AppState, ExcalidrawImperativeAPI, ImportedDataState } from "@excalidraw/excalidraw/types";

interface ExcalidrawWrapperProps {
  setElements: (elements: readonly ExcalidrawElement[]) => void;
  setSelectedElements: (elements: readonly ExcalidrawElement[]) => void;
  setExcalidrawAPI: (api: ExcalidrawImperativeAPI) => void;
  initialData: ImportedDataState | null;
}

const UI_OPTIONS = {
  canvasActions: {
    changeViewBackgroundColor: false,
    clearCanvas: true,
    loadScene: false,
    saveToActiveFile: false,
    toggleTheme: false,
    saveAsImage: true,
  },
};

const ExcalidrawWrapper = React.memo(function ExcalidrawWrapper({
  setElements,
  setSelectedElements,
  setExcalidrawAPI,
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

  const handleExcalidrawAPI = React.useCallback((api: ExcalidrawImperativeAPI) => {
    apiRef.current = api;
    setExcalidrawAPI(api);
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

    if (newlyDeletedIds.size > 0 && apiRef.current) {
      let needsUpdate = false;
      const newElementsToUpdate = excalidrawElements.map(el => {
        if (el.isDeleted) return el;
        
        let shouldDelete = false;
        
        // 1. Text bound to the deleted node
        if (el.type === "text") {
          const textEl = el as unknown as ExcalidrawTextElement;
          if (textEl.containerId && newlyDeletedIds.has(textEl.containerId)) {
            shouldDelete = true;
          }
        }
        
        // 2. Arrow (relationship) connected to the deleted node
        if (el.type === "arrow") {
          const prevArrow = prevElements.find(pe => pe.id === el.id);
          if (prevArrow && prevArrow.type === "arrow") {
             const arrow = prevArrow as unknown as ExcalidrawArrowElement;
             const startId = arrow.startBinding?.elementId;
             const endId = arrow.endBinding?.elementId;
             if ((startId && newlyDeletedIds.has(startId)) || (endId && newlyDeletedIds.has(endId))) {
               shouldDelete = true;
             }
          }
        }

        if (shouldDelete) {
          needsUpdate = true;
          return { ...el, isDeleted: true };
        }
        return el;
      });

      if (needsUpdate) {
        // Update scene to mark relationships and text as deleted too
        apiRef.current.updateScene({ elements: newElementsToUpdate });
        return; // Wait for the subsequent onChange to update state
      }
    }

    prevElementsRef.current = excalidrawElements;
    setElements(excalidrawElements);
    
    // Extract selected elements
    const selectedIds = Object.keys(appState.selectedElementIds || {}).filter(
      id => appState.selectedElementIds[id]
    );
    const selected = excalidrawElements.filter(el => selectedIds.includes(el.id) && !el.isDeleted);
    setSelectedElements(selected);
  }, [setElements, setSelectedElements]);

  return (
    <div className="absolute inset-0">
      <Excalidraw
        theme="dark"
        onChange={onChange}
        UIOptions={UI_OPTIONS}
        onExcalidrawAPI={handleExcalidrawAPI}
        initialData={initialData}
      />
    </div>
  );
});

export default ExcalidrawWrapper;
