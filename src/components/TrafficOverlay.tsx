import React, { useEffect, useRef } from "react";
import type { ExcalidrawElement } from "@excalidraw/excalidraw/element/types";
import { NodeMetrics } from "@/lib/simulation/SimulationEngine";
import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";

interface TrafficOverlayProps {
  isSimulating: boolean;
  excalidrawAPI: ExcalidrawImperativeAPI | null;
  metrics: Record<string, NodeMetrics>;
}

export default function TrafficOverlay({ isSimulating, excalidrawAPI, metrics }: TrafficOverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!isSimulating || !excalidrawAPI || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationId: number;

    const animate = () => {
      // Resize canvas to match parent
      if (canvas.width !== canvas.parentElement!.clientWidth || canvas.height !== canvas.parentElement!.clientHeight) {
        canvas.width = canvas.parentElement!.clientWidth;
        canvas.height = canvas.parentElement!.clientHeight;
      }

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const appState = excalidrawAPI.getAppState();
      const elements = excalidrawAPI.getSceneElements();

      const time = performance.now() / 1000; // time in seconds

      // Find active arrows — guard heavily since elements can change mid-simulation
      elements.forEach((el: ExcalidrawElement) => {
        try {
          if (el.type !== "arrow" || !el.customData?.wasSimulating) return;
          if (!el.points || !Array.isArray(el.points) || el.points.length < 2) return;

          // Only animate traffic if the source node has processed traffic > 0
          let hasTraffic = false;
          let trafficVolume = 0;
          if (el.startBinding?.elementId) {
            const sourceMetrics = metrics[el.startBinding.elementId];
            if (sourceMetrics && sourceMetrics.processed > 0) {
              hasTraffic = true;
              trafficVolume = sourceMetrics.processed;
            }
          }

          if (!hasTraffic) return;

          const points = el.points;

          // Dynamic particle count based on traffic volume (min 1, max 10)
          const numParticles = Math.max(1, Math.min(10, Math.ceil(trafficVolume / 100)));
          const speed = 1.0 + Math.min(2.0, trafficVolume / 1000);

          // Pre-compute segments and total path length
          let totalLength = 0;
          const segments: { dist: number; sx: number; sy: number; ex: number; ey: number }[] = [];
          for (let j = 0; j < points.length - 1; j++) {
            const sx = Number(points[j][0]);
            const sy = Number(points[j][1]);
            const ex = Number(points[j + 1][0]);
            const ey = Number(points[j + 1][1]);
            if (isNaN(sx) || isNaN(sy) || isNaN(ex) || isNaN(ey)) return;
            const dist = Math.sqrt((ex - sx) ** 2 + (ey - sy) ** 2);
            segments.push({ dist, sx, sy, ex, ey });
            totalLength += dist;
          }

          if (totalLength === 0) return;

          for (let i = 0; i < numParticles; i++) {
            const duration = 2.0 / speed;
            const offset = i / numParticles;
            const progress = ((time / duration) + offset) % 1.0;

            const targetLength = progress * totalLength;
            let currentLength = 0;
            let px = Number(points[0][0]);
            let py = Number(points[0][1]);

            for (const seg of segments) {
              if (currentLength + seg.dist >= targetLength) {
                const ratio = (targetLength - currentLength) / seg.dist;
                px = seg.sx + ratio * (seg.ex - seg.sx);
                py = seg.sy + ratio * (seg.ey - seg.sy);
                break;
              }
              currentLength += seg.dist;
            }

            // Map to screen coordinates
            const screenX = (el.x + px + appState.scrollX) * appState.zoom.value;
            const screenY = (el.y + py + appState.scrollY) * appState.zoom.value;

            // Draw glowing particle
            ctx.beginPath();
            ctx.arc(screenX, screenY, 4 * appState.zoom.value, 0, Math.PI * 2);
            ctx.fillStyle = "#60a5fa";
            ctx.shadowColor = "#3b82f6";
            ctx.shadowBlur = 10 * appState.zoom.value;
            ctx.fill();
            ctx.shadowBlur = 0;
          }
        } catch {
          // Silently skip malformed elements during live drawing
        }
      });

      animationId = requestAnimationFrame(animate);
    };

    animate();

    return () => cancelAnimationFrame(animationId);
  }, [isSimulating, excalidrawAPI, metrics]);

  if (!isSimulating) return null;

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 pointer-events-none z-[5]"
    />
  );
}
