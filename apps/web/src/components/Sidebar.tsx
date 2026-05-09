import React, { useState, useEffect } from "react";
import type { ExcalidrawElement } from "@excalidraw/excalidraw/element/types";

import type { NodeMetrics } from "@/lib/simulation/SimulationEngine";

import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";
import type { ComponentCustomData } from "@/lib/simulation/types";
import {
  getComponentsByCategory,
  getDefaultInstanceForType,
  isClientType,
} from "@/lib/simulation/ComponentRegistry";

interface SidebarProps {
  elements: readonly ExcalidrawElement[];
  selectedElements: readonly ExcalidrawElement[];
  setElements: (elements: readonly ExcalidrawElement[]) => void;
  excalidrawAPI: ExcalidrawImperativeAPI | null;
  metrics?: Record<string, NodeMetrics>;
}

const LB_STRATEGIES = [
  "Round Robin",
  "Smart Load Monitor",
  "Consistent Hashing",
];

import { getNextNameForType } from "@/lib/utils/nameGenerator";

/** Pre-compute grouped components so we only build this once */
const GROUPED_COMPONENTS = getComponentsByCategory();

export default function Sidebar({ elements, selectedElements, setElements, excalidrawAPI, metrics = {} }: SidebarProps) {
  const [activeTab, setActiveTab] = useState<"Properties" | "Metrics">("Properties");

  // Local string state for the replicas input so users can clear and retype.
  // Synced from customData when the selected node changes or +/- buttons modify it.
  const selectedNodeId = selectedElements.length > 0 ? selectedElements[0].id : null;
  const selectedCustomData = selectedElements.length > 0
    ? (selectedElements[0].customData as ComponentCustomData) || {}
    : {};
  const externalReplicas = selectedCustomData.replicas;

  const [replicasInput, setReplicasInput] = useState<string>(
    String(externalReplicas ?? 1)
  );

  useEffect(() => {
    setReplicasInput(String(externalReplicas ?? 1));
  }, [selectedNodeId, externalReplicas]);

  if (selectedElements.length === 0) {
    return (
      <aside className="w-80 bg-[#1a1a1a] border-l border-[#2a2a2a] p-6 flex flex-col">
        <div className="flex-1 flex flex-col items-center justify-center text-gray-500 text-center">
          <svg className="w-12 h-12 mb-4 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
          </svg>
          <p>Select a node on the canvas to view its properties and metrics.</p>
        </div>
      </aside>
    );
  }

  const selectedNode = selectedElements[0];
  const customData = (selectedNode.customData as ComponentCustomData) || {};
  const liveMetrics = metrics[selectedNode.id] || { incoming: 0, processed: 0, dropped: 0 };

  const instanceInfo = customData.componentType
    ? getDefaultInstanceForType(customData.componentType)
    : null;

  // Use engine-computed metrics when available for accurate load display
  const replicas = (liveMetrics as NodeMetrics).replicas
    ?? Math.max(1, Math.floor(Number(customData.replicas) || 1));
  const effectiveCapacity = (liveMetrics as NodeMetrics).effectiveCapacity
    ?? (customData.maxCapacity || instanceInfo?.maxCapacity || 0) * replicas;
  const loadPercent = effectiveCapacity > 0
    ? Math.min(100, (liveMetrics.incoming / effectiveCapacity) * 100)
    : 0;

  const updateCustomData = (updates: Partial<ComponentCustomData>) => {
    let newElements = [...elements];

    let newName = updates.name !== undefined ? updates.name : customData.name;
    const isNewTypeSelection = updates.componentType && updates.componentType !== customData.componentType;

    if (isNewTypeSelection && !customData.name) {
      newName = getNextNameForType(updates.componentType!, elements);
      updates.name = newName;
    } else if (updates.name === "") {
      newName = getNextNameForType(customData.componentType || "New Service", elements);
      updates.name = newName;
    }

    // Auto-assign instance when component type changes
    if (isNewTypeSelection && updates.componentType) {
      const defaultInst = getDefaultInstanceForType(updates.componentType);
      updates.instanceType = defaultInst.instanceType;
      updates.maxCapacity = defaultInst.maxCapacity;
    }

    // Update or create bound text element if name is changing
    // Only bind text to basic shapes, not images or complex SVGs
    const isBasicShape = ["rectangle", "ellipse", "diamond", "cylinder"].includes(selectedNode.type);
    
    if (isBasicShape && newName !== undefined && newName !== customData.name) {
      const boundTextRef = selectedNode.boundElements?.find((e) => e.type === "text");
      if (boundTextRef) {
        newElements = newElements.map(el => {
          if (el.id === boundTextRef.id) {
            return { ...el, text: newName, originalText: newName };
          }
          return el;
        });
      } else if (excalidrawAPI) {
        const textElementId = Math.random().toString(36).substring(2, 10);
        const newTextElement = {
          id: textElementId,
          type: "text",
          x: (selectedNode.x || 0) + (selectedNode.width || 0) / 2 - 50,
          y: (selectedNode.y || 0) + (selectedNode.height || 0) / 2 - 12.5,
          width: 100,
          height: 25,
          angle: 0,
          strokeColor: selectedNode.strokeColor,
          backgroundColor: "transparent",
          fillStyle: "hachure",
          strokeWidth: 1,
          strokeStyle: "solid",
          roughness: 1,
          opacity: 100,
          groupIds: selectedNode.groupIds || [],
          frameId: selectedNode.frameId || null,
          roundness: null,
          seed: Math.floor(Math.random() * 100000),
          version: 1,
          versionNonce: Math.floor(Math.random() * 100000),
          isDeleted: false,
          boundElements: null,
          updated: Date.now(),
          link: null,
          locked: false,
          text: newName,
          fontSize: 20,
          fontFamily: 1,
          textAlign: "center",
          verticalAlign: "middle",
          baseline: 18,
          containerId: selectedNode.id,
          originalText: newName,
          lineHeight: 1.2
        };

        newElements.push(newTextElement as unknown as ExcalidrawElement);

        newElements = newElements.map(el => {
          if (el.id === selectedNode.id) {
            return {
              ...el,
              boundElements: [...(el.boundElements || []), { type: "text", id: textElementId }]
            };
          }
          return el;
        });
      }
    }

    newElements = newElements.map(el => {
      if (el.id === selectedNode.id) {
        return {
          ...el,
          customData: {
            ...(el.customData as ComponentCustomData || {}),
            ...updates
          }
        };
      }
      return el;
    });

    setElements(newElements);
    if (excalidrawAPI) {
      excalidrawAPI.updateScene({ elements: newElements });
    }
  };

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    updateCustomData({ name: e.target.value });
  };

  const handleComponentTypeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    updateCustomData({ componentType: e.target.value });
  };

  const isLBType =
    customData.componentType === "Load Balancer" ||
    customData.componentType === "ALB";

  const isClient = customData.componentType
    ? isClientType(customData.componentType)
    : false;

  return (
    <aside className="w-80 bg-[#1a1a1a] border-l border-[#2a2a2a] flex flex-col h-full">
      {/* Tabs */}
      <div className="flex border-b border-[#2a2a2a]">
        <button
          className={`flex-1 py-3 text-sm font-medium transition-colors ${
            activeTab === "Properties"
              ? "text-indigo-400 border-b-2 border-indigo-500 bg-[#222]"
              : "text-gray-400 hover:text-gray-200 hover:bg-[#222]"
          }`}
          onClick={() => setActiveTab("Properties")}
        >
          Properties
        </button>
        <button
          className={`flex-1 py-3 text-sm font-medium transition-colors ${
            activeTab === "Metrics"
              ? "text-indigo-400 border-b-2 border-indigo-500 bg-[#222]"
              : "text-gray-400 hover:text-gray-200 hover:bg-[#222]"
          }`}
          onClick={() => setActiveTab("Metrics")}
        >
          Metrics
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-5">
        {activeTab === "Properties" ? (
          <div className="space-y-6">
            <div>
              <h3 className="text-sm font-medium text-gray-400 mb-2 uppercase tracking-wider">Node Configuration</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-gray-300 mb-1">Name</label>
                  <input
                    type="text"
                    className="w-full bg-[#2a2a2a] border border-[#3a3a3a] rounded-md px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                    value={customData.name || ""}
                    onChange={handleNameChange}
                    placeholder="e.g. Client 1"
                  />
                </div>

                <div>
                  <label className="block text-sm text-gray-300 mb-1">Component Type</label>
                  <select
                    className="w-full bg-[#2a2a2a] border border-[#3a3a3a] rounded-md px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                    value={customData.componentType || ""}
                    onChange={handleComponentTypeChange}
                  >
                    <option value="" disabled>Select Type...</option>
                    {GROUPED_COMPONENTS.map(({ category, components }) => (
                      <optgroup key={category} label={category}>
                        {components.map(({ key, def }) => (
                          <option key={key} value={key}>{def.label}</option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm text-gray-300 mb-1">Source RPS (Optional)</label>
                  <input
                    type="number"
                    min="0"
                    className="w-full bg-[#2a2a2a] border border-[#3a3a3a] rounded-md px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                    value={customData.sourceRps ?? ""}
                    onChange={(e) => updateCustomData({ sourceRps: e.target.value === "" ? undefined : Number(e.target.value) })}
                    placeholder="e.g. 100 (For disjoint components)"
                  />
                  <p className="text-xs text-gray-500 mt-1">Generates its own traffic independent of global RPS.</p>
                </div>

                {!isClient && (
                  <div>
                    <label className="block text-sm text-gray-300 mb-1">Replicas</label>
                    <div className="flex items-center gap-2">
                      <button
                        className="w-8 h-8 bg-[#2a2a2a] border border-[#3a3a3a] rounded-md text-white hover:bg-[#3a3a3a] hover:border-indigo-500 transition-colors flex items-center justify-center text-lg font-medium disabled:opacity-30 disabled:cursor-not-allowed"
                        onClick={() => {
                          const current = Math.max(1, Math.floor(Number(customData.replicas) || 1));
                          if (current > 1) updateCustomData({ replicas: current - 1 });
                        }}
                        disabled={!customData.replicas || customData.replicas <= 1}
                        aria-label="Decrease replicas"
                      >
                        −
                      </button>
                      <input
                        type="number"
                        min="1"
                        max="100"
                        className="flex-1 bg-[#2a2a2a] border border-[#3a3a3a] rounded-md px-3 py-2 text-white text-center font-mono focus:outline-none focus:border-indigo-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        value={replicasInput}
                        onChange={(e) => setReplicasInput(e.target.value)}
                        onBlur={() => {
                          const val = parseInt(replicasInput, 10);
                          if (!isNaN(val) && val >= 1 && val <= 100) {
                            updateCustomData({ replicas: val });
                          } else {
                            updateCustomData({ replicas: 1 });
                            setReplicasInput("1");
                          }
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            (e.target as HTMLInputElement).blur();
                          }
                        }}
                      />
                      <button
                        className="w-8 h-8 bg-[#2a2a2a] border border-[#3a3a3a] rounded-md text-white hover:bg-[#3a3a3a] hover:border-indigo-500 transition-colors flex items-center justify-center text-lg font-medium disabled:opacity-30 disabled:cursor-not-allowed"
                        onClick={() => {
                          const current = Math.max(1, Math.floor(Number(customData.replicas) || 1));
                          if (current < 100) updateCustomData({ replicas: current + 1 });
                        }}
                        disabled={customData.replicas !== undefined && customData.replicas >= 100}
                        aria-label="Increase replicas"
                      >
                        +
                      </button>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">Horizontal scaling — multiplies capacity.</p>
                  </div>
                )}

                {isLBType && (
                  <div>
                    <label className="block text-sm text-gray-300 mb-1">Routing Strategy</label>
                    <select
                      className="w-full bg-[#2a2a2a] border border-[#3a3a3a] rounded-md px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                      value={customData.lbStrategy || "Round Robin"}
                      onChange={(e) => updateCustomData({ lbStrategy: e.target.value })}
                    >
                      {LB_STRATEGIES.map(s => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            </div>

            {/* Instance details — shown as read-only neon info block */}
            {instanceInfo && !isClient && (
              <>
                <hr className="border-[#3a3a3a]" />
                <div className="bg-[#111] border border-cyan-500/30 rounded-lg p-4 space-y-2">
                  <h4 className="text-xs font-semibold text-cyan-400 uppercase tracking-wider mb-2">Instance Details</h4>
                  <div className="flex justify-between">
                    <span className="text-gray-400 text-sm">Type</span>
                    <span className="text-cyan-300 font-mono text-sm">{instanceInfo.instanceName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400 text-sm">Per-Instance RPS</span>
                    <span className="text-cyan-300 font-mono text-sm">{instanceInfo.maxCapacity.toLocaleString()}</span>
                  </div>
                  {replicas > 1 && (
                    <div className="flex justify-between">
                      <span className="text-gray-400 text-sm">Replicas</span>
                      <span className="text-indigo-400 font-mono text-sm font-bold">×{replicas}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-gray-400 text-sm">{replicas > 1 ? 'Effective Capacity' : 'Max RPS'}</span>
                    <span className={`font-mono text-sm ${replicas > 1 ? 'text-indigo-300 font-bold' : 'text-cyan-300'}`}>
                      {effectiveCapacity.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400 text-sm">Load</span>
                    <span className={`font-mono text-sm font-bold ${
                      loadPercent >= 100 ? "text-red-400" : loadPercent >= 70 ? "text-yellow-400" : "text-cyan-300"
                    }`}>
                      ~{loadPercent.toFixed(0)}%
                    </span>
                  </div>
                  <div className="w-full bg-[#1a1a1a] rounded-full h-1.5 overflow-hidden mt-1">
                    <div
                      className={`h-full transition-all duration-300 ${
                        loadPercent >= 100 ? "bg-red-500" : loadPercent >= 70 ? "bg-yellow-500" : "bg-cyan-400"
                      }`}
                      style={{ width: `${Math.min(100, loadPercent)}%` }}
                    ></div>
                  </div>
                </div>
              </>
            )}
          </div>
        ) : (
          <div className="space-y-6">
            <h3 className="text-sm font-medium text-gray-400 mb-2 uppercase tracking-wider">Live Metrics</h3>

            <div className={`bg-[#222] border ${liveMetrics.dropped > 0 ? "border-red-500/50" : "border-[#3a3a3a]"} rounded-lg p-4 space-y-3 transition-colors duration-300`}>
              <div className="flex justify-between items-center">
                <span className="text-gray-400 text-sm">Incoming RPS</span>
                <span className="font-mono text-indigo-400">{liveMetrics.incoming.toFixed(0)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-400 text-sm">Processed RPS</span>
                <span className="font-mono text-green-400">{liveMetrics.processed.toFixed(0)}</span>
              </div>
              <div className="flex justify-between items-center pt-2 border-t border-[#3a3a3a]">
                <span className={`${liveMetrics.dropped > 0 ? "text-red-400" : "text-gray-400"} text-sm font-medium`}>Dropped (503s)</span>
                <span className={`font-mono ${liveMetrics.dropped > 0 ? "text-red-500 font-bold" : "text-gray-500"}`}>
                  {liveMetrics.dropped.toFixed(0)}
                </span>
              </div>
              {replicas > 1 && liveMetrics.incoming > 0 && (
                <div className="mt-3 pt-3 border-t border-[#3a3a3a]">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-gray-400 text-xs uppercase">Per-Replica Load</span>
                    <span className="text-xs font-mono text-indigo-400">
                      ~{Math.round(liveMetrics.incoming / replicas).toLocaleString()} RPS
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400 text-xs">Replicas</span>
                    <span className="text-xs font-mono text-indigo-300 font-bold">×{replicas}</span>
                  </div>
                </div>
              )}
              {isFinite(effectiveCapacity) && effectiveCapacity > 0 && (
                <div className="mt-4 pt-3 border-t border-[#3a3a3a]">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-gray-400 text-xs uppercase">Resource Usage</span>
                    <span className={`text-xs font-mono ${loadPercent >= 100 ? 'text-red-400' : loadPercent >= 70 ? 'text-yellow-400' : 'text-green-400'}`}>
                      {Math.min(100, loadPercent).toFixed(1)}%
                    </span>
                  </div>
                  <div className="w-full bg-[#111] rounded-full h-1.5 overflow-hidden">
                    <div
                      className={`h-full transition-all duration-300 ${loadPercent >= 100 ? 'bg-red-500' : loadPercent >= 70 ? 'bg-yellow-500' : 'bg-green-500'}`}
                      style={{ width: `${Math.min(100, loadPercent)}%` }}
                    ></div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
