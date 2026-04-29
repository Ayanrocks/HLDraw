import React from "react";

interface TopBarProps {
  isSimulating: boolean;
  setIsSimulating: (simulating: boolean) => void;
  globalRps: number;
  setGlobalRps: (rps: number) => void;
  simulationError: string | null;
}

export default function TopBar({
  isSimulating,
  setIsSimulating,
  globalRps,
  setGlobalRps,
  simulationError,
}: TopBarProps) {
  return (
    <header className="flex items-center justify-between px-6 py-3 bg-[#1e1e1e] border-b border-[#2a2a2a] shadow-sm">
      <div className="flex items-center gap-3">
        <h1 className="text-xl font-bold bg-gradient-to-r from-blue-400 to-indigo-500 bg-clip-text text-transparent">
          HLDraw
        </h1>
        <span className="text-xs px-2 py-1 bg-blue-500/20 text-blue-300 rounded-full font-medium">
          Architecture Simulator
        </span>
      </div>

      {simulationError && (
        <div className="text-red-400 text-sm font-medium animate-pulse">
          ⚠️ {simulationError}
        </div>
      )}

      <div className="flex items-center gap-6">
        <div className="flex items-center gap-3">
          <label htmlFor="rps-slider" className="text-sm font-medium text-gray-300">
            Client Load (RPS): <span className="text-white font-bold w-12 inline-block">{globalRps}</span>
          </label>
          <input
            id="rps-slider"
            type="range"
            min="10"
            max="10000"
            step="10"
            value={globalRps}
            onChange={(e) => setGlobalRps(parseInt(e.target.value))}
            className="w-32 accent-indigo-500 cursor-pointer"
            disabled={isSimulating}
          />
        </div>

        <button
          onClick={() => setIsSimulating(!isSimulating)}
          className={`px-6 py-2 rounded-lg font-semibold transition-all duration-200 shadow-lg flex items-center gap-2 ${isSimulating
              ? "bg-red-500 hover:bg-red-600 shadow-red-500/20 text-white"
              : "bg-indigo-500 hover:bg-indigo-600 shadow-indigo-500/20 text-white"
            }`}
        >
          {isSimulating ? (
            <>
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-200 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-white"></span>
              </span>
              Stop Simulation
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path d="M4 4l12 6-12 6V4z" />
              </svg>
              Start Simulation
            </>
          )}
        </button>
      </div>
    </header>
  );
}
