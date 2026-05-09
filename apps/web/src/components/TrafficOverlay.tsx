import React, { useEffect, useRef } from "react";
import type { ExcalidrawElement } from "@excalidraw/excalidraw/element/types";
import { NodeMetrics } from "@/lib/simulation/SimulationEngine";
import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";
import { isClientType } from "@/lib/simulation/ComponentRegistry";
import type { ComponentCustomData } from "@/lib/simulation/types";

interface TrafficOverlayProps {
  isSimulating: boolean;
  excalidrawAPI: ExcalidrawImperativeAPI | null;
  metrics: Record<string, NodeMetrics>;
}

interface ErrorParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
}

/** Hard cap on simultaneous error particles to prevent memory bloat */
const MAX_ERROR_PARTICLES = 100;

export default function TrafficOverlay({ isSimulating, excalidrawAPI, metrics }: TrafficOverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const errorParticlesRef = useRef<ErrorParticle[]>([]);
  const lastTimeRef = useRef<number>(performance.now() / 1000);

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
      const dt = time - lastTimeRef.current;
      lastTimeRef.current = time;

      // Filter dead particles and enforce hard cap to prevent memory bloat
      errorParticlesRef.current = errorParticlesRef.current.filter(p => p.life > 0);
      if (errorParticlesRef.current.length > MAX_ERROR_PARTICLES) {
        errorParticlesRef.current = errorParticlesRef.current.slice(-MAX_ERROR_PARTICLES);
      }

      // Draw component overlays (highlights and watermarks)
      elements.forEach((el: ExcalidrawElement) => {
        if (el.isDeleted || el.type === "arrow" || el.type === "text" || el.type === "freedraw") return;

        const nodeMetrics = metrics[el.id];
        if (!nodeMetrics) return;

        // Clients generate traffic — they don't receive it, so skip load display
        const componentType = (el.customData as ComponentCustomData)?.componentType || "";
        if (isClientType(componentType)) return;

        const { effectiveCapacity, incoming } = nodeMetrics;
        const replicaCount = nodeMetrics.replicas;

        if (incoming === 0) return;

        const isOverloaded = nodeMetrics.dropped > 0;
        const hasFiniteCapacity = isFinite(effectiveCapacity) && effectiveCapacity > 0;
        const loadPct = hasFiniteCapacity
          ? Math.round((incoming / effectiveCapacity) * 100)
          : 0;

        const screenX = (el.x + appState.scrollX) * appState.zoom.value;
        const screenY = (el.y + appState.scrollY) * appState.zoom.value;
        const screenW = el.width * appState.zoom.value;
        const screenH = el.height * appState.zoom.value;

        ctx.save();
        ctx.translate(screenX + screenW / 2, screenY + screenH / 2);
        if (el.angle) ctx.rotate(el.angle);

        // Highlight overloaded component
        if (isOverloaded) {
          ctx.fillStyle = "rgba(239, 68, 68, 0.15)";
          ctx.strokeStyle = "rgba(239, 68, 68, 0.8)";
          ctx.lineWidth = 2 * appState.zoom.value;
          ctx.shadowColor = "rgba(239, 68, 68, 0.6)";
          ctx.shadowBlur = 20 * appState.zoom.value;

          ctx.beginPath();
          ctx.roundRect(-screenW / 2, -screenH / 2, screenW, screenH, 8 * appState.zoom.value);
          ctx.fill();
          ctx.stroke();

          // Spawn 503 error particles
          // Scale spawn rate based on dropped amount, but cap it
          const spawnChance = Math.min(0.8, nodeMetrics.dropped / 50);
          if (Math.random() < spawnChance) {
            errorParticlesRef.current.push({
              x: el.x + el.width / 2 + (Math.random() - 0.5) * el.width * 0.8,
              y: el.y + el.height / 2 + (Math.random() - 0.5) * el.height * 0.8,
              vx: (Math.random() - 0.5) * 60,
              vy: -80 - Math.random() * 60,
              life: 1.5,
              maxLife: 1.5 + Math.random() * 0.5
            });
          }
        }

        // Text below the component for Load %
        const fontSize = 14 * appState.zoom.value;
        ctx.font = `bold ${fontSize}px sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "top";

        const replicaSuffix = replicaCount > 1 ? ` ×${replicaCount}` : "";
        const loadLabel = hasFiniteCapacity
          ? `${loadPct}% load${replicaSuffix}`
          : `${Math.round(incoming)} RPS${replicaSuffix}`;

        const textY = screenH / 2 + 8 * appState.zoom.value;
        const textMetrics = ctx.measureText(loadLabel);
        const paddingX = 6 * appState.zoom.value;
        const paddingY = 3 * appState.zoom.value;
        const pillWidth = textMetrics.width + paddingX * 2;
        const pillHeight = fontSize + paddingY * 2;

        // Dark background pill for readability on any canvas
        ctx.fillStyle = "rgba(0, 0, 0, 0.75)";
        ctx.beginPath();
        ctx.roundRect(
          -pillWidth / 2,
          textY - paddingY,
          pillWidth,
          pillHeight,
          4 * appState.zoom.value
        );
        ctx.fill();

        // Text with dark stroke outline for extra contrast
        const textColor = isOverloaded ? "#f87171" : "#6ee7b7";
        ctx.strokeStyle = "rgba(0, 0, 0, 0.9)";
        ctx.lineWidth = 3 * appState.zoom.value;
        ctx.lineJoin = "round";
        ctx.strokeText(loadLabel, 0, textY);

        ctx.fillStyle = textColor;
        ctx.fillText(loadLabel, 0, textY);

        ctx.restore();
      });

      // Update and draw 503 particles
      errorParticlesRef.current.forEach(p => {
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vy += 150 * dt; // Gravity effect
        p.life -= dt;

        const screenX = (p.x + appState.scrollX) * appState.zoom.value;
        const screenY = (p.y + appState.scrollY) * appState.zoom.value;
        
        const opacity = Math.max(0, p.life / p.maxLife);
        const scale = 1.0 + (1.0 - opacity) * 0.5; // Slight grow over time
        const fontSize = 16 * appState.zoom.value * scale;

        ctx.save();
        ctx.fillStyle = `rgba(239, 68, 68, ${opacity})`;
        ctx.shadowColor = `rgba(239, 68, 68, ${opacity * 0.8})`;
        ctx.shadowBlur = 8 * appState.zoom.value;
        ctx.font = `bold ${fontSize}px monospace`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("503", screenX, screenY);
        ctx.restore();
      });

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

    return () => {
      cancelAnimationFrame(animationId);
      // Clear particle data to release memory between simulation sessions
      errorParticlesRef.current = [];
    };
  }, [isSimulating, excalidrawAPI, metrics]);

  if (!isSimulating) return null;

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 pointer-events-none z-[5]"
    />
  );
}
