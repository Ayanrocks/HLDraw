import React from "react";
import { Excalidraw } from "@excalidraw/excalidraw";
import "@excalidraw/excalidraw/index.css";
import type { ExcalidrawElement } from "@excalidraw/excalidraw/element/types";
import type { AppState } from "@excalidraw/excalidraw/types";

interface ExcalidrawWrapperProps {
  setElements: (elements: readonly ExcalidrawElement[]) => void;
  setSelectedElements: (elements: readonly ExcalidrawElement[]) => void;
  setExcalidrawAPI: (api: any) => void;
  initialData: any;
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
  const onChange = React.useCallback((
    excalidrawElements: readonly ExcalidrawElement[],
    appState: AppState
  ) => {
    setElements(excalidrawElements);
    
    // Extract selected elements
    const selectedIds = Object.keys(appState.selectedElementIds || {}).filter(
      id => appState.selectedElementIds[id]
    );
    const selected = excalidrawElements.filter(el => selectedIds.includes(el.id));
    setSelectedElements(selected);
  }, [setElements, setSelectedElements]);

  return (
    <div className="absolute inset-0">
      <Excalidraw
        theme="dark"
        onChange={onChange}
        UIOptions={UI_OPTIONS}
        onExcalidrawAPI={setExcalidrawAPI}
        initialData={initialData}
      />
    </div>
  );
});

export default ExcalidrawWrapper;
