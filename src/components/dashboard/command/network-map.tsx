"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Cpu, Globe2 } from "lucide-react";
import { CreateMonitorDialog } from "@/components/dashboard/create-monitor-dialog";
import { WebsiteLogo } from "@/components/dashboard/website-logo";
import { getDomainFromUrl } from "@/lib/utils";
import { cn } from "@/lib/utils";

export interface NetworkMonitor {
  id: string;
  name: string;
  url: string;
  faviconUrl?: string | null;
  status: string;
  lastChangedAt: string | null;
  _count?: { changes: number };
}

interface NodePosition {
  id: string;
  name: string;
  url: string;
  faviconUrl?: string | null;
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

function statusLabel(status: string): string {
  if (status === "ACTIVE") return "Active";
  if (status === "PAUSED") return "Paused";
  if (status === "ERROR") return "Error";
  return status;
}

function statusDotClass(status: string): string {
  if (status === "ACTIVE") return "bg-emerald-400";
  if (status === "PAUSED") return "bg-amber-400";
  if (status === "ERROR") return "bg-red-400";
  return "bg-zinc-500";
}

export function NetworkMap({ monitors }: { monitors: NetworkMonitor[] }) {
  const router = useRouter();
  const [pulseId, setPulseId] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);

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

  useEffect(() => {
    if (selectedId && !monitors.some((m) => m.id === selectedId)) {
      setSelectedId(null);
    }
  }, [monitors, selectedId]);

  const selected = useMemo(
    () => monitors.find((m) => m.id === selectedId) ?? null,
    [monitors, selectedId]
  );

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
        url: m.url,
        faviconUrl: m.faviconUrl,
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
    <div className="relative min-h-[420px] w-full overflow-hidden rounded-2xl border border-white/[0.06] bg-[#060606] sm:min-h-[520px] lg:min-h-[640px]" data-tour="global-map">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(34,211,238,0.06),transparent_65%)]" />

      <div className="absolute left-4 top-4 z-10 sm:left-5">
        <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-cyan-500/70">
          Network Grid
        </p>
        <h3 className="mt-1 text-sm font-medium text-zinc-200 sm:text-base">
          Global Monitor Map
        </h3>
        {selected && (
          <p className="mt-1 max-w-[200px] truncate font-mono text-[10px] text-zinc-600 sm:max-w-xs">
            Focus: {selected.name}
          </p>
        )}
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
        <div className="relative mx-auto flex h-full min-h-[420px] w-full items-center justify-center sm:min-h-[520px] lg:min-h-[640px]">
          <div className="relative aspect-[800/600] h-auto w-full max-h-[min(640px,85vw)]">
          <svg
            viewBox="0 0 800 600"
            className="absolute inset-0 h-full w-full"
            preserveAspectRatio="xMidYMid meet"
            aria-hidden
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
                  stroke={
                    selectedId === node.id
                      ? "rgba(34,211,238,0.55)"
                      : node.pulsing
                        ? "rgba(34,211,238,0.45)"
                        : "rgba(56,189,248,0.08)"
                  }
                  strokeWidth={selectedId === node.id || node.pulsing ? 1.5 : 0.8}
                  animate={
                    node.pulsing || selectedId === node.id
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
              style={{ transformOrigin: `${core.x}px ${core.y}px` }}
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
            </motion.g>
          </svg>

          {/* AI Core avatar overlay — synced to viewBox center */}
          <div
            className="pointer-events-none absolute left-1/2 top-1/2 z-[5] flex -translate-x-1/2 -translate-y-1/2 flex-col items-center"
            style={{ marginTop: 0 }}
          >
            <div className="relative flex h-14 w-14 items-center justify-center sm:h-16 sm:w-16">
              <AnimatePresence mode="wait" initial={false}>
                {selected ? (
                  <motion.div
                    key={selected.id}
                    initial={{ opacity: 0, scale: 0.7, rotate: -8 }}
                    animate={{ opacity: 1, scale: 1, rotate: 0 }}
                    exit={{ opacity: 0, scale: 0.75, rotate: 8 }}
                    transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
                    className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full border border-cyan-400/40 bg-[#090909] shadow-[0_0_24px_-6px_rgba(34,211,238,0.55)] sm:h-11 sm:w-11"
                  >
                    <WebsiteLogo
                      url={selected.url}
                      faviconUrl={selected.faviconUrl}
                      size={28}
                      alt={selected.name}
                      className="rounded-full"
                    />
                  </motion.div>
                ) : (
                  <motion.div
                    key="ai-core-default"
                    initial={{ opacity: 0, scale: 0.7 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.75 }}
                    transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
                    className="flex h-10 w-10 items-center justify-center rounded-full border border-cyan-400/40 bg-cyan-500/10 sm:h-11 sm:w-11"
                  >
                    <Cpu className="h-5 w-5 text-cyan-300 sm:h-5 sm:w-5" />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            <p className="mt-8 font-mono text-[9px] tracking-[0.3em] text-sky-300/70 sm:mt-10 sm:text-[10px]">
              AI CORE
            </p>
          </div>

          {/* HTML node cards — logos + labels; positions mirror SVG viewBox */}
          {nodes.map((node, i) => {
            const isSelected = selectedId === node.id;
            return (
              <motion.button
                key={node.id}
                type="button"
                initial={{ opacity: 0, scale: 0.6 }}
                animate={{
                  opacity: 1,
                  scale: 1,
                  y: [0, -3, 0],
                }}
                transition={{
                  opacity: { delay: i * 0.06 },
                  scale: { delay: i * 0.06, type: "spring" },
                  y: { duration: 3 + (i % 3), repeat: Infinity, ease: "easeInOut" },
                }}
                className={cn(
                  "absolute z-10 flex max-w-[7.5rem] -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-1 rounded-xl border px-1.5 py-1.5 text-center backdrop-blur-sm transition-colors sm:max-w-[8.5rem] sm:px-2",
                  isSelected
                    ? "border-cyan-400/50 bg-cyan-500/15 shadow-[0_0_20px_-6px_rgba(34,211,238,0.5)]"
                    : "border-white/[0.08] bg-[#090909]/85 hover:border-cyan-400/30 hover:bg-cyan-500/[0.08]",
                  node.pulsing && !isSelected && "border-cyan-400/35"
                )}
                style={{
                  left: `${(node.x / 800) * 100}%`,
                  top: `${(node.y / 600) * 100}%`,
                }}
                onClick={() => setSelectedId((curr) => (curr === node.id ? null : node.id))}
                onDoubleClick={() => router.push(`/dashboard/monitors/${node.id}`)}
                title={`${node.name} · ${node.domain} · double-click to open`}
                aria-pressed={isSelected}
              >
                <span className="relative flex h-9 w-9 items-center justify-center rounded-lg border border-white/[0.1] bg-black/60 sm:h-10 sm:w-10">
                  <WebsiteLogo
                    url={node.url}
                    faviconUrl={node.faviconUrl}
                    size={22}
                    alt=""
                  />
                  <span
                    className={cn(
                      "absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full ring-2 ring-[#090909]",
                      statusDotClass(node.status)
                    )}
                    title={statusLabel(node.status)}
                  />
                </span>
                <span className="w-full truncate text-[10px] font-medium leading-tight text-zinc-200 sm:text-[11px]">
                  {node.name}
                </span>
                <span className="w-full truncate font-mono text-[8px] leading-tight text-zinc-500 sm:text-[9px]">
                  {node.domain}
                </span>
                <span className="font-mono text-[8px] uppercase tracking-wider text-zinc-600">
                  {statusLabel(node.status)}
                </span>
              </motion.button>
            );
          })}
          </div>
        </div>
      )}
    </div>
  );
}
