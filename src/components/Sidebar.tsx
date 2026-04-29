import React, { useState } from "react";
import type { ExcalidrawElement } from "@excalidraw/excalidraw/element/types";

interface SidebarProps {
  elements: readonly ExcalidrawElement[];
  selectedElements: readonly ExcalidrawElement[];
  setElements: (elements: readonly ExcalidrawElement[]) => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  excalidrawAPI: any;
}

const AWS_INSTANCES: Record<string, { name: string; type: string; rps: number }> = {
  "t3.micro": { name: "t3.micro", type: "App Server", rps: 100 },
  "t3.small": { name: "t3.small", type: "App Server", rps: 250 },
  "m5.large": { name: "m5.large", type: "Web Server", rps: 1500 },
  "m5.xlarge": { name: "m5.xlarge", type: "Web Server", rps: 3000 },
  "db.t3.medium": { name: "db.t3.medium", type: "Database", rps: 500 },
  "db.m5.large": { name: "db.m5.large", type: "Database", rps: 2000 },
  "cache.t3.micro": { name: "cache.t3.micro", type: "Cache", rps: 5000 },
  "alb.standard": { name: "alb.standard", type: "Load Balancer", rps: 10000 },
  "client.default": { name: "client.default", type: "Client", rps: 0 }, // RPS controlled globally
};

const COMPONENT_TYPES = [
  "Client",
  "ALB",
  "Web Server",
  "App Server",
  "DB",
  "Cache",
  "Message Queue",
];

const LB_STRATEGIES = [
  "Round Robin",
  "Smart Load Monitor",
  "Consistent Hashing",
];

import { getNextNameForType } from "@/lib/utils/nameGenerator";

export default function Sidebar({ elements, selectedElements, setElements, excalidrawAPI }: SidebarProps) {
  const [activeTab, setActiveTab] = useState<"Properties" | "Metrics">("Properties");

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
  // Extract custom data, or default to an empty object
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const customData = (selectedNode.customData as Record<string, any>) || {};

  // Handle property updates
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updateCustomData = (updates: Record<string, any>) => {
    let newElements = [...elements];
    
    // Check if we need to update name due to type change or empty name
    let newName = updates.name !== undefined ? updates.name : customData.name;
    const isNewTypeSelection = updates.componentType && updates.componentType !== customData.componentType;
    
    if (isNewTypeSelection && !customData.name) {
      newName = getNextNameForType(updates.componentType, elements);
      updates.name = newName;
    } else if (updates.name === "") {
      newName = getNextNameForType(customData.componentType || "New Service", elements);
      updates.name = newName;
    }
    
    // Update or create bound text element if name is changing
    if (newName !== undefined && newName !== customData.name) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const boundTextRef = selectedNode.boundElements?.find((e: any) => e.type === "text");
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
          x: selectedNode.x + selectedNode.width / 2 - 50,
          y: selectedNode.y + selectedNode.height / 2 - 12.5,
          width: 100, // Excalidraw will auto-calculate actual size
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
        
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        newElements.push(newTextElement as any);
        
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
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            ...(el.customData as Record<string, any> || {}),
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

  const handleInstanceTypeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const instance = AWS_INSTANCES[e.target.value];
    if (instance) {
      updateCustomData({ 
        instanceType: e.target.value,
        maxCapacity: instance.rps
      });
    }
  };

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
                    {COMPONENT_TYPES.map(t => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>

                {customData.componentType && customData.componentType !== "Client" && (
                  <div>
                    <label className="block text-sm text-gray-300 mb-1">Instance Type</label>
                    <select
                      className="w-full bg-[#2a2a2a] border border-[#3a3a3a] rounded-md px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                      value={customData.instanceType || ""}
                      onChange={handleInstanceTypeChange}
                    >
                      <option value="" disabled>Select Instance...</option>
                      {Object.entries(AWS_INSTANCES).map(([key, inst]) => (
                        <option key={key} value={key}>
                          {inst.name} ({inst.rps} RPS)
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {customData.componentType === "ALB" && (
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

                <div>
                  <label className="block text-sm text-gray-300 mb-1">Max Capacity (RPS)</label>
                  <input
                    type="number"
                    className="w-full bg-[#2a2a2a] border border-[#3a3a3a] rounded-md px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                    value={customData.maxCapacity || 0}
                    disabled
                  />
                  <p className="text-xs text-gray-500 mt-1">Automatically set by Instance Type.</p>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            <h3 className="text-sm font-medium text-gray-400 mb-2 uppercase tracking-wider">Live Metrics</h3>
            
            <div className="bg-[#222] border border-[#3a3a3a] rounded-lg p-4 space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-gray-400 text-sm">Incoming RPS</span>
                <span className="font-mono text-green-400">{customData.metrics?.incoming || 0}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-400 text-sm">Processed RPS</span>
                <span className="font-mono text-blue-400">{customData.metrics?.processed || 0}</span>
              </div>
              <div className="flex justify-between items-center pt-2 border-t border-[#3a3a3a]">
                <span className="text-gray-400 text-sm">Dropped (503s)</span>
                <span className="font-mono text-red-400">{customData.metrics?.dropped || 0}</span>
              </div>
            </div>

            <div className="bg-[#222] border border-[#3a3a3a] rounded-lg p-4">
              <div className="text-sm text-gray-400 mb-2">Capacity Utilization</div>
              <div className="w-full bg-[#1a1a1a] rounded-full h-2.5">
                {/* Calculate utilization percentage */}
                {(() => {
                  const incoming = customData.metrics?.incoming || 0;
                  const max = customData.maxCapacity || 1;
                  const util = Math.min(100, Math.round((incoming / max) * 100));
                  const colorClass = util > 90 ? "bg-red-500" : util > 70 ? "bg-yellow-500" : "bg-green-500";
                  
                  return (
                    <div className={`${colorClass} h-2.5 rounded-full transition-all duration-300`} style={{ width: `${util}%` }}></div>
                  );
                })()}
              </div>
              <div className="text-right text-xs text-gray-500 mt-1">
                {(() => {
                  const incoming = customData.metrics?.incoming || 0;
                  const max = customData.maxCapacity || 1;
                  return `${Math.round((incoming / max) * 100)}%`;
                })()}
              </div>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
