import React, { useState, useMemo, useCallback } from "react";
import { convertToExcalidrawElements } from "@excalidraw/excalidraw";
import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";
import type { ExcalidrawElement } from "@excalidraw/excalidraw/element/types";
import {
  getComponentsByCategory,
  COMPONENT_REGISTRY,
  type ComponentCategory,
} from "@/lib/simulation/ComponentRegistry";

interface ComponentPaletteProps {
  excalidrawAPI: ExcalidrawImperativeAPI | null;
  elements: readonly ExcalidrawElement[];
  setElements: (elements: readonly ExcalidrawElement[]) => void;
}

/**
 * Maps component categories to the native excalidraw shape type
 * used when inserting that component onto the canvas.
 */
const SHAPE_FOR_CATEGORY: Record<ComponentCategory, string> = {
  Clients: "rectangle",
  Compute: "rectangle",
  Databases: "ellipse",
  Storage: "diamond",
  Networking: "ellipse",
  Messaging: "rectangle",
  Security: "diamond",
};

/**
 * Override shape for specific component types where the category
 * default doesn't make sense visually.
 */
const SHAPE_OVERRIDES: Record<string, string> = {
  "Load Balancer": "diamond",
  Cache: "diamond",
  Cloud: "cloud",
  CDN: "cloud",
  DNS: "ellipse",
  Database: "cylinder",
  "Relational DB": "cylinder",
  "Document DB": "cylinder",
  "Columnar DB": "cylinder",
  "Graph DB": "cylinder",
  "Message Queue": "queue",
  Pipeline: "queue",
};

/**
 * Returns dimensions (width, height) for a given shape type.
 */
function getDimensions(shapeType: string): { width: number; height: number } {
  switch (shapeType) {
    case "ellipse":
      return { width: 140, height: 90 };
    case "diamond":
      return { width: 150, height: 100 };
    default:
      return { width: 160, height: 80 };
  }
}

/**
 * Returns the native excalidraw shape type for a component key.
 */
function getShapeType(componentKey: string): string {
  if (SHAPE_OVERRIDES[componentKey]) {
    return SHAPE_OVERRIDES[componentKey];
  }
  const def = COMPONENT_REGISTRY[componentKey];
  return def ? SHAPE_FOR_CATEGORY[def.category] : "rectangle";
}

/** Category icons — small SVG icons to visually distinguish groups */
const CATEGORY_ICONS: Record<ComponentCategory, React.ReactNode> = {
  Clients: (
    <svg viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
      <path d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" />
    </svg>
  ),
  Compute: (
    <svg viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
      <path fillRule="evenodd" d="M2 5a2 2 0 012-2h12a2 2 0 012 2v10a2 2 0 01-2 2H4a2 2 0 01-2-2V5zm3.293 1.293a1 1 0 011.414 0l3 3a1 1 0 010 1.414l-3 3a1 1 0 01-1.414-1.414L7.586 10 5.293 7.707a1 1 0 010-1.414zM11 12a1 1 0 100 2h3a1 1 0 100-2h-3z" clipRule="evenodd" />
    </svg>
  ),
  Databases: (
    <svg viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
      <path d="M3 12v3c0 1.657 3.134 3 7 3s7-1.343 7-3v-3c0 1.657-3.134 3-7 3s-7-1.343-7-3z" />
      <path d="M3 7v3c0 1.657 3.134 3 7 3s7-1.343 7-3V7c0 1.657-3.134 3-7 3S3 8.657 3 7z" />
      <path d="M17 5c0 1.657-3.134 3-7 3S3 6.657 3 5s3.134-3 7-3 7 1.343 7 3z" />
    </svg>
  ),
  Storage: (
    <svg viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
      <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
    </svg>
  ),
  Networking: (
    <svg viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
      <path fillRule="evenodd" d="M12.586 4.586a2 2 0 112.828 2.828l-3 3a2 2 0 01-2.828 0 1 1 0 00-1.414 1.414 4 4 0 005.656 0l3-3a4 4 0 00-5.656-5.656l-1.5 1.5a1 1 0 101.414 1.414l1.5-1.5zm-5 5a2 2 0 012.828 0 1 1 0 101.414-1.414 4 4 0 00-5.656 0l-3 3a4 4 0 105.656 5.656l1.5-1.5a1 1 0 10-1.414-1.414l-1.5 1.5a2 2 0 11-2.828-2.828l3-3z" clipRule="evenodd" />
    </svg>
  ),
  Messaging: (
    <svg viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
      <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
      <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
    </svg>
  ),
  Security: (
    <svg viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
      <path fillRule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
    </svg>
  ),
};

/** Pre-compute grouped components */
const GROUPED = getComponentsByCategory();

/**
 * Returns shape styles (colors) for a given component category.
 */
function getShapeStyles(category: ComponentCategory): { backgroundColor: string; strokeColor: string } {
  switch (category) {
    case "Clients":
      return { backgroundColor: "#e0f2fe", strokeColor: "#0284c7" }; // Sky
    case "Compute":
      return { backgroundColor: "#ffedd5", strokeColor: "#ea580c" }; // Orange
    case "Databases":
      return { backgroundColor: "#fef9c3", strokeColor: "#16a34a" }; // Yellow, Green stroke
    case "Storage":
      return { backgroundColor: "#dcfce7", strokeColor: "#15803d" }; // Green
    case "Networking":
      return { backgroundColor: "#f3e8ff", strokeColor: "#9333ea" }; // Purple
    case "Messaging":
      return { backgroundColor: "#fee2e2", strokeColor: "#dc2626" }; // Red
    case "Security":
      return { backgroundColor: "#fce7f3", strokeColor: "#db2777" }; // Pink
    default:
      return { backgroundColor: "#f3f4f6", strokeColor: "#4b5563" }; // Gray
  }
}

export default function ComponentPalette({
  excalidrawAPI,
  elements,
  setElements,
}: ComponentPaletteProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");

  const filteredGroups = useMemo(() => {
    if (!search.trim()) return GROUPED;
    const q = search.toLowerCase();
    return GROUPED.map((g) => ({
      ...g,
      components: g.components.filter(
        ({ key, def }) =>
          key.toLowerCase().includes(q) ||
          def.description.toLowerCase().includes(q),
      ),
    })).filter((g) => g.components.length > 0);
  }, [search]);

  const insertComponent = useCallback(
    (componentKey: string) => {
      if (!excalidrawAPI) return;

      const appState = excalidrawAPI.getAppState();
      const shapeType = getShapeType(componentKey);
      const { width, height } = getDimensions(shapeType);
      
      const category = COMPONENT_REGISTRY[componentKey]?.category || "Compute";
      const { backgroundColor, strokeColor } = getShapeStyles(category);

      // Place shape at the center of the current viewport
      const centerX =
        -appState.scrollX + appState.width / 2 / appState.zoom.value - width / 2;
      const centerY =
        -appState.scrollY + appState.height / 2 / appState.zoom.value - height / 2;

      const skeleton = [
        {
          type: shapeType,
          x: centerX,
          y: centerY,
          width,
          height,
          strokeColor,
          backgroundColor,
          fillStyle: "solid",
          label: {
            text: componentKey,
          },
          customData: {
            componentType: componentKey,
            name: componentKey,
            instanceType: COMPONENT_REGISTRY[componentKey]?.instanceType,
            maxCapacity: COMPONENT_REGISTRY[componentKey]?.maxCapacity,
          },
        },
      ];

      try {
        const newElements = convertToExcalidrawElements(skeleton as any);

        const existingElements = excalidrawAPI.getSceneElements();
        const merged = [...existingElements, ...newElements];

        excalidrawAPI.updateScene({ elements: merged });
        setElements(merged);

        // Select the newly added container shape
        const containerId = newElements[0]?.id;
        if (containerId) {
          excalidrawAPI.updateScene({
            appState: {
              selectedElementIds: { [containerId]: true },
            },
          });
        }
      } catch (err) {
        console.error("Failed to insert component:", err);
      }

      setIsOpen(false);
      setSearch("");
    },
    [excalidrawAPI, setElements],
  );

  return (
    <div className="absolute bottom-20 left-4 z-10">
      {/* Toggle button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`
          flex items-center gap-2 px-4 py-2.5 rounded-xl
          font-semibold text-sm shadow-lg
          transition-all duration-200
          ${
            isOpen
              ? "bg-primary-600 text-white shadow-primary-500/30"
              : "bg-[#232323] text-gray-200 border border-[#3a3a3a] hover:bg-[#2a2a2a] hover:border-primary-500/40 shadow-black/30"
          }
        `}
        title="System Design Components"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="w-4 h-4"
        >
          <rect x="3" y="3" width="7" height="7" />
          <rect x="14" y="3" width="7" height="7" />
          <rect x="3" y="14" width="7" height="7" />
          <path d="M17.5 14v7M14 17.5h7" />
        </svg>
        Components
      </button>

      {/* Palette panel */}
      {isOpen && (
        <div className="absolute bottom-14 left-0 w-80 max-h-[28rem] bg-[#1e1e1e] border border-[#3a3a3a] rounded-xl shadow-2xl shadow-black/50 overflow-hidden flex flex-col">
          {/* Search */}
          <div className="p-3 border-b border-[#2a2a2a]">
            <input
              type="text"
              placeholder="Search components..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-[#2a2a2a] border border-[#3a3a3a] rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-primary-500"
              autoFocus
            />
          </div>

          {/* Component list */}
          <div className="overflow-y-auto flex-1 p-2">
            {filteredGroups.length === 0 ? (
              <div className="text-center text-gray-500 py-8 text-sm">
                No components found
              </div>
            ) : (
              filteredGroups.map(({ category, components }) => (
                <div key={category} className="mb-3">
                  <div className="flex items-center gap-2 px-2 py-1.5 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                    <span className="text-gray-500">
                      {CATEGORY_ICONS[category]}
                    </span>
                    {category}
                  </div>
                  <div className="grid grid-cols-2 gap-1">
                    {components.map(({ key, def }) => {
                      const shape = getShapeType(key);
                      return (
                        <button
                          key={key}
                          onClick={() => insertComponent(key)}
                          className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-left text-sm text-gray-200 hover:bg-primary-600/20 hover:text-white transition-colors group"
                          title={def.description}
                        >
                          <ShapeIcon shape={shape} />
                          <span className="truncate">{def.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Tiny shape indicator icon — shows the excalidraw shape
 * that will be used for this component.
 */
function ShapeIcon({ shape }: { shape: string }) {
  const cls =
    "w-5 h-5 flex-shrink-0 text-gray-500 group-hover:text-primary-400 transition-colors";

  switch (shape) {
    case "ellipse":
      return (
        <svg viewBox="0 0 20 20" className={cls}>
          <ellipse
            cx="10"
            cy="10"
            rx="8"
            ry="6"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          />
        </svg>
      );
    case "diamond":
      return (
        <svg viewBox="0 0 20 20" className={cls}>
          <path
            d="M10 2 L18 10 L10 18 L2 10 Z"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          />
        </svg>
      );
    case "cylinder":
      return (
        <svg viewBox="0 0 20 20" className={cls}>
          <path
            d="M 4 6 A 6 2 0 1 0 16 6 A 6 2 0 1 0 4 6 L 4 14 A 6 2 0 0 0 16 14 L 16 6"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          />
          <path d="M 4 9 A 6 2 0 0 0 16 9 M 4 11.5 A 6 2 0 0 0 16 11.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
        </svg>
      );
    case "queue":
      return (
        <svg viewBox="0 0 20 20" className={cls}>
          <path
            d="M 6 5 L 14 5 A 2 5 0 1 1 14 15 L 6 15 A 2 5 0 1 1 6 5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          />
          <path d="M 8 7 L 11 10 L 8 13 M 12 7 L 15 10 L 12 13" fill="none" stroke="currentColor" strokeWidth="1.5" />
        </svg>
      );
    case "cloud":
      return (
        <svg viewBox="0 0 20 20" className={cls}>
          <path
            d="M 6 14 C 3 14 2 10 5 8 C 5 5 9 4 11 6 C 13 4 17 6 16 9 C 19 10 18 14 15 14 Z"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
        </svg>
      );
    default:
      return (
        <svg viewBox="0 0 20 20" className={cls}>
          <rect
            x="2"
            y="4"
            width="16"
            height="12"
            rx="2"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          />
        </svg>
      );
  }
}
