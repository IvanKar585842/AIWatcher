"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Globe2 } from "lucide-react";
import { CreateMonitorDialog } from "@/components/dashboard/create-monitor-dialog";
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
    const cy = 300;
    const baseRadius = monitors.length <= 3 ? 160 : monitors.length <= 6 ? 190 : 220;

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

  const core = { x: 400, y: 300 };

  return (
    <div className="relative min-h-[420px] w-full overflow-hidden rounded-2xl border border-white/[0.06] bg-[#060606] sm:min-h-[520px] lg:min-h-[640px]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(34,211,238,0.06),transparent_65%)]" />

      <div className="absolute left-4 top-4 z-10 sm:left-5">
        <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-cyan-500/70">
          Network Grid
        </p>
        <h3 className="mt-1 text-sm font-medium text-zinc-200 sm:text-base">
          Global Monitor Map
        </h3>
      </div>

      {monitors.length === 0 ? (
        <div className="relative z-10 flex min-h-[420px] flex-col items-center justify-center px-6 py-16 text-center sm:min-h-[520px] lg:min-h-[640px]">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-cyan-400/20 bg-cyan-500/10">
            <Globe2 className="h-6 w-6 text-cyan-400/80" />
          </div>
          <p className="text-sm font-medium text-zinc-200">No monitored websites yet</p>
          <p className="mt-2 max-w-sm text-xs leading-relaxed text-zinc-500">
            Create your first monitor to see your global monitoring map.
          </p>
          <div className="mt-6">
            <CreateMonitorDialog
              variant="os"
              triggerLabel="Create Monitor"
              triggerClassName="h-11 px-6 text-sm"
              onCreated={() => {
                window.dispatchEvent(new CustomEvent("monitors-updated"));
              }}
            />
          </div>
        </div>
      ) : (
        <svg
          viewBox="0 0 800 600"
          className="h-full w-full min-h-[420px] sm:min-h-[520px] lg:min-h-[640px]"
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

          {Array.from({ length: 14 }).map((_, row) =>
            Array.from({ length: 20 }).map((__, col) => (
              <circle
                key={`${row}-${col}`}
                cx={40 + col * 38}
                cy={40 + row * 40}
                r="0.6"
                fill="rgba(125,211,252,0.08)"
              />
            ))
          )}

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
            <circle cx={core.x} cy={core.y} r="8" fill="rgba(34,211,238,0.8)" />
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
      )}
    </div>
  );
}
