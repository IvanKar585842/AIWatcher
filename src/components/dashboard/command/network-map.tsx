"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { getDomainFromUrl } from "@/lib/utils";

export interface NetworkMonitor {
  id: string;
  name: string;
  url: string;
  status: string;
  lastChangedAt: string | null;
  _count?: { changes: number };
}

interface NodePosition {
  id: string;
  name: string;
  domain: string;
  x: number;
  y: number;
  status: string;
  pulsing: boolean;
  changes: number;
}

function hashAngle(id: string): number {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash << 5) - hash + id.charCodeAt(i);
    hash |= 0;
  }
  return (hash % 360) * (Math.PI / 180);
}

function isRecentlyChanged(lastChangedAt: string | null): boolean {
  if (!lastChangedAt) return false;
  return Date.now() - new Date(lastChangedAt).getTime() < 60 * 60 * 1000;
}

export function NetworkMap({ monitors }: { monitors: NetworkMonitor[] }) {
  const router = useRouter();
  const [pulseId, setPulseId] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 3000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const recent = monitors.filter((m) => isRecentlyChanged(m.lastChangedAt));
    if (recent.length > 0) {
      const idx = tick % recent.length;
      setPulseId(recent[idx]?.id ?? null);
    }
  }, [monitors, tick]);

  const nodes = useMemo((): NodePosition[] => {
    const cx = 400;
    const cy = 260;
    const baseRadius = monitors.length <= 3 ? 140 : monitors.length <= 6 ? 170 : 200;

    return monitors.map((m, i) => {
      const angle = hashAngle(m.id) + (i / Math.max(monitors.length, 1)) * 0.4;
      const radius = baseRadius + (i % 3) * 28;
      return {
        id: m.id,
        name: m.name,
        domain: getDomainFromUrl(m.url),
        x: cx + Math.cos(angle) * radius,
        y: cy + Math.sin(angle) * radius,
        status: m.status,
        pulsing: isRecentlyChanged(m.lastChangedAt) || pulseId === m.id,
        changes: m._count?.changes ?? 0,
      };
    });
  }, [monitors, pulseId]);

  const core = { x: 400, y: 260 };

  return (
    <div className="relative h-full min-h-[360px] w-full overflow-hidden rounded-2xl border border-white/[0.06] bg-[#060606]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(34,211,238,0.06),transparent_65%)]" />

      <div className="absolute left-5 top-4 z-10">
        <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-cyan-500/70">
          Network Grid
        </p>
        <h3 className="mt-1 text-sm font-medium text-zinc-200">Global Monitor Map</h3>
      </div>

      <svg
        viewBox="0 0 800 520"
        className="h-full w-full"
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          <radialGradient id="coreGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="rgba(34,211,238,0.35)" />
            <stop offset="100%" stopColor="rgba(34,211,238,0)" />
          </radialGradient>
          <filter id="nodeGlow">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Grid dots */}
        {Array.from({ length: 12 }).map((_, row) =>
          Array.from({ length: 20 }).map((__, col) => (
            <circle
              key={`${row}-${col}`}
              cx={40 + col * 38}
              cy={40 + row * 38}
              r="0.6"
              fill="rgba(125,211,252,0.08)"
            />
          ))
        )}

        {/* Connection lines */}
        {nodes.map((node) => (
          <g key={`line-${node.id}`}>
            <motion.line
              x1={core.x}
              y1={core.y}
              x2={node.x}
              y2={node.y}
              stroke={node.pulsing ? "rgba(34,211,238,0.45)" : "rgba(56,189,248,0.08)"}
              strokeWidth={node.pulsing ? 1.5 : 0.8}
              animate={
                node.pulsing
                  ? { strokeOpacity: [0.3, 0.8, 0.3] }
                  : { strokeOpacity: 0.15 }
              }
              transition={{ duration: 2, repeat: Infinity }}
            />
            {node.pulsing && (
              <motion.circle
                r="3"
                fill="#22d3ee"
                filter="url(#nodeGlow)"
                animate={{
                  cx: [core.x, node.x],
                  cy: [core.y, node.y],
                  opacity: [0, 1, 0],
                }}
                transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
              />
            )}
          </g>
        ))}

        {/* AI Core */}
        <motion.g
          animate={{ scale: [1, 1.04, 1] }}
          transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
        >
          <circle cx={core.x} cy={core.y} r="52" fill="url(#coreGlow)" />
          <circle
            cx={core.x}
            cy={core.y}
            r="28"
            fill="rgba(9,9,9,0.9)"
            stroke="rgba(34,211,238,0.5)"
            strokeWidth="1.5"
          />
          <circle
            cx={core.x}
            cy={core.y}
            r="8"
            fill="rgba(34,211,238,0.8)"
          />
          <text
            x={core.x}
            y={core.y + 48}
            textAnchor="middle"
            fill="rgba(125,211,252,0.7)"
            fontSize="10"
            fontFamily="monospace"
            letterSpacing="3"
          >
            AI CORE
          </text>
        </motion.g>

        {/* Monitor nodes */}
        {nodes.map((node, i) => (
          <motion.g
            key={node.id}
            initial={{ opacity: 0, scale: 0 }}
            animate={{
              opacity: 1,
              scale: 1,
              y: [0, -4, 0],
            }}
            transition={{
              opacity: { delay: i * 0.08 },
              scale: { delay: i * 0.08, type: "spring" },
              y: { duration: 3 + (i % 3), repeat: Infinity, ease: "easeInOut" },
            }}
            style={{ cursor: "pointer" }}
            onClick={() => router.push(`/dashboard/monitors/${node.id}`)}
          >
              {node.pulsing && (
                <motion.circle
                  cx={node.x}
                  cy={node.y}
                  r="22"
                  fill="none"
                  stroke="rgba(34,211,238,0.4)"
                  strokeWidth="1"
                  animate={{ r: [18, 28, 18], opacity: [0.6, 0, 0.6] }}
                  transition={{ duration: 2, repeat: Infinity }}
                />
              )}
              <circle
                cx={node.x}
                cy={node.y}
                r="14"
                fill={node.status === "ERROR" ? "rgba(239,68,68,0.15)" : "rgba(9,9,9,0.95)"}
                stroke={
                  node.pulsing
                    ? "rgba(34,211,238,0.8)"
                    : node.status === "ACTIVE"
                      ? "rgba(56,189,248,0.35)"
                      : "rgba(113,113,122,0.3)"
                }
                strokeWidth="1.2"
                filter={node.pulsing ? "url(#nodeGlow)" : undefined}
              />
              <text
                x={node.x}
                y={node.y + 28}
                textAnchor="middle"
                fill="rgba(212,212,216,0.8)"
                fontSize="9"
                fontFamily="system-ui"
              >
                {node.name.length > 14 ? `${node.name.slice(0, 12)}…` : node.name}
              </text>
              <text
                x={node.x}
                y={node.y + 40}
                textAnchor="middle"
                fill="rgba(113,113,122,0.7)"
                fontSize="7"
                fontFamily="monospace"
              >
                {node.domain}
              </text>
          </motion.g>
        ))}
      </svg>

      {monitors.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center">
          <p className="text-sm text-zinc-600">Add monitors to populate the network</p>
        </div>
      )}
    </div>
  );
}
