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

/** Responsive layout metrics from monitor density. */
export type MapScale = {
  /** 1 = few monitors, ~0.42 = dense */
  factor: number;
  iconBox: number;
  logoSize: number;
  cardMaxW: number;
  showDomain: boolean;
  showStatus: boolean;
  nameFont: number;
  coreOuter: number;
  coreInner: number;
  coreLogo: number;
  coreCpu: number;
  glowR: number;
  coreR: number;
  labelGap: number;
  pulseR: number;
};

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

/**
 * Smooth density scale: large at ≤5, medium ~20, compact at 100+.
 */
export function computeMapScale(count: number): MapScale {
  const n = Math.max(0, count);
  // Piecewise map → factor in [0.42, 1]
  let factor = 1;
  if (n <= 5) factor = 1;
  else if (n <= 20) factor = 1 - ((n - 5) / 15) * 0.28; // → 0.72
  else if (n <= 50) factor = 0.72 - ((n - 20) / 30) * 0.18; // → 0.54
  else factor = clamp(0.54 - ((n - 50) / 80) * 0.12, 0.42, 0.54);

  const iconBox = Math.round(clamp(40 * factor, 22, 40));
  const logoSize = Math.round(clamp(22 * factor, 12, 22));
  const coreOuter = Math.round(clamp(64 * factor, 34, 64));
  const coreInner = Math.round(clamp(44 * factor, 26, 44));
  const coreLogo = Math.round(clamp(28 * factor, 16, 28));
  const coreCpu = Math.round(clamp(20 * factor, 12, 20));

  return {
    factor,
    iconBox,
    logoSize,
    cardMaxW: Math.round(clamp(136 * factor, 56, 136)),
    showDomain: n <= 18,
    showStatus: n <= 12,
    nameFont: clamp(11 * factor, 8, 11),
    coreOuter,
    coreInner,
    coreLogo,
    coreCpu,
    glowR: 52 * factor,
    coreR: 28 * factor,
    labelGap: Math.round(clamp(32 * factor, 18, 32)),
    pulseR: 18 * factor,
  };
}

function hashAngle(id: string): number {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash << 5) - hash + id.charCodeAt(i);
    hash |= 0;
  }
  return ((hash >>> 0) % 360) * (Math.PI / 180);
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

const VIEW_W = 800;
const VIEW_H = 600;
const CX = 400;
const CY = 300;

/**
 * Place nodes on 1–3 rings with even spacing; keep clear of AI Core and edges.
 */
function layoutNodes(
  monitors: NetworkMonitor[],
  scale: MapScale,
  pulseId: string | null
): NodePosition[] {
  const count = monitors.length;
  if (count === 0) return [];

  const cardHalf = scale.cardMaxW / 2;
  const edgePad = Math.max(cardHalf + 8, 36 * scale.factor);
  const coreClearance = scale.coreR + scale.iconBox / 2 + 28 * scale.factor + 16;

  const rings = count <= 8 ? 1 : count <= 24 ? 2 : 3;
  const ringSpacing = clamp(44 * scale.factor + 8, 28, 56);
  const baseRadius = Math.max(coreClearance, 120 * scale.factor + 40);

  // Assign each monitor to a ring (round-robin density)
  const ringCounts = Array.from({ length: rings }, () => 0);
  const assignments: number[] = [];
  for (let i = 0; i < count; i++) {
    const ring = i % rings;
    assignments.push(ring);
    ringCounts[ring]!++;
  }
  const ringIndex = Array.from({ length: rings }, () => 0);

  return monitors.map((m, i) => {
    const ring = assignments[i]!;
    const idxOnRing = ringIndex[ring]!;
    ringIndex[ring]!++;
    const onRing = Math.max(1, ringCounts[ring]!);
    const angle =
      (idxOnRing / onRing) * Math.PI * 2 +
      hashAngle(m.id) * 0.02 +
      ring * 0.35;

    let radius = baseRadius + ring * ringSpacing;
    // Slight bounded offset so rings don't look like a rigid lattice
    const jitter =
      ((((hashAngle(m.id) * 1000) | 0) % 17) - 8) * 0.6 * scale.factor;
    radius += jitter;

    let x = CX + Math.cos(angle) * radius;
    let y = CY + Math.sin(angle) * radius;

    // Keep inside container — push inward if outside pad box
    x = clamp(x, edgePad, VIEW_W - edgePad);
    y = clamp(y, edgePad + 28, VIEW_H - edgePad);

    // Push away from core if too close after clamp
    const dx = x - CX;
    const dy = y - CY;
    const dist = Math.hypot(dx, dy) || 1;
    if (dist < coreClearance) {
      const push = coreClearance / dist;
      x = CX + dx * push;
      y = CY + dy * push;
      x = clamp(x, edgePad, VIEW_W - edgePad);
      y = clamp(y, edgePad + 28, VIEW_H - edgePad);
    }

    return {
      id: m.id,
      name: m.name,
      url: m.url,
      faviconUrl: m.faviconUrl,
      domain: getDomainFromUrl(m.url),
      x,
      y,
      status: m.status,
      pulsing: isRecentlyChanged(m.lastChangedAt) || pulseId === m.id,
      changes: m._count?.changes ?? 0,
    };
  });
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

  const scale = useMemo(() => computeMapScale(monitors.length), [monitors.length]);

  const nodes = useMemo(
    () => layoutNodes(monitors, scale, pulseId),
    [monitors, scale, pulseId]
  );

  const core = { x: CX, y: CY };

  return (
    <div
      className="relative min-h-[420px] w-full overflow-hidden rounded-2xl border border-white/[0.06] bg-[#060606] sm:min-h-[520px] lg:min-h-[640px]"
      data-tour="global-map"
    >
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
        <div className="relative mx-auto flex h-full min-h-[420px] w-full max-w-full items-center justify-center overflow-hidden sm:min-h-[520px] lg:min-h-[640px]">
          <div className="relative aspect-[800/600] h-auto w-full max-h-[min(640px,92vw)] min-w-0">
            <svg
              viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
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
                      r={Math.max(2, 3 * scale.factor)}
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
                <motion.circle
                  cx={core.x}
                  cy={core.y}
                  animate={{ r: scale.glowR }}
                  transition={{ type: "spring", stiffness: 260, damping: 28 }}
                  fill="url(#coreGlow)"
                />
                <motion.circle
                  cx={core.x}
                  cy={core.y}
                  animate={{ r: scale.coreR }}
                  transition={{ type: "spring", stiffness: 260, damping: 28 }}
                  fill="rgba(9,9,9,0.9)"
                  stroke="rgba(34,211,238,0.5)"
                  strokeWidth="1.5"
                />
              </motion.g>
            </svg>

            {/* AI Core avatar — scales with density */}
            <div className="pointer-events-none absolute left-1/2 top-1/2 z-[5] flex -translate-x-1/2 -translate-y-1/2 flex-col items-center">
              <motion.div
                className="relative flex items-center justify-center"
                animate={{ width: scale.coreOuter, height: scale.coreOuter }}
                transition={{ type: "spring", stiffness: 280, damping: 30 }}
              >
                <AnimatePresence mode="wait" initial={false}>
                  {selected ? (
                    <motion.div
                      key={selected.id}
                      initial={{ opacity: 0, scale: 0.7, rotate: -8 }}
                      animate={{ opacity: 1, scale: 1, rotate: 0 }}
                      exit={{ opacity: 0, scale: 0.75, rotate: 8 }}
                      transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
                      className="flex items-center justify-center overflow-hidden rounded-full border border-cyan-400/40 bg-[#090909] shadow-[0_0_24px_-6px_rgba(34,211,238,0.55)]"
                      style={{ width: scale.coreInner, height: scale.coreInner }}
                    >
                      <WebsiteLogo
                        url={selected.url}
                        faviconUrl={selected.faviconUrl}
                        size={scale.coreLogo}
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
                      className="flex items-center justify-center rounded-full border border-cyan-400/40 bg-cyan-500/10"
                      style={{ width: scale.coreInner, height: scale.coreInner }}
                    >
                      <Cpu
                        className="text-cyan-300"
                        style={{ width: scale.coreCpu, height: scale.coreCpu }}
                      />
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
              <p
                className="font-mono tracking-[0.3em] text-sky-300/70"
                style={{
                  marginTop: scale.labelGap,
                  fontSize: clamp(8 * scale.factor, 7, 10),
                }}
              >
                AI CORE
              </p>
            </div>

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
                    y: monitors.length <= 24 ? [0, -3, 0] : 0,
                  }}
                  transition={{
                    opacity: { delay: Math.min(i * 0.04, 0.6) },
                    scale: {
                      delay: Math.min(i * 0.04, 0.6),
                      type: "spring",
                      stiffness: 320,
                      damping: 28,
                    },
                    y:
                      monitors.length <= 24
                        ? { duration: 3 + (i % 3), repeat: Infinity, ease: "easeInOut" }
                        : undefined,
                    width: { type: "spring", stiffness: 280, damping: 30 },
                  }}
                  className={cn(
                    "absolute z-10 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-0.5 rounded-xl border px-1 py-1 text-center backdrop-blur-sm transition-[border-color,background-color,box-shadow] duration-300 sm:px-1.5 sm:py-1.5",
                    isSelected
                      ? "border-cyan-400/50 bg-cyan-500/15 shadow-[0_0_20px_-6px_rgba(34,211,238,0.5)]"
                      : "border-white/[0.08] bg-[#090909]/85 hover:border-cyan-400/30 hover:bg-cyan-500/[0.08]",
                    node.pulsing && !isSelected && "border-cyan-400/35"
                  )}
                  style={{
                    left: `${(node.x / VIEW_W) * 100}%`,
                    top: `${(node.y / VIEW_H) * 100}%`,
                    maxWidth: scale.cardMaxW,
                    width: scale.cardMaxW,
                  }}
                  onClick={() => setSelectedId((curr) => (curr === node.id ? null : node.id))}
                  onDoubleClick={() => router.push(`/dashboard/monitors/${node.id}`)}
                  title={`${node.name} · ${node.domain} · double-click to open`}
                  aria-pressed={isSelected}
                >
                  <motion.span
                    className="relative flex shrink-0 items-center justify-center rounded-lg border border-white/[0.1] bg-black/60"
                    animate={{ width: scale.iconBox, height: scale.iconBox }}
                    transition={{ type: "spring", stiffness: 280, damping: 30 }}
                  >
                    <WebsiteLogo
                      url={node.url}
                      faviconUrl={node.faviconUrl}
                      size={scale.logoSize}
                      alt=""
                    />
                    <span
                      className={cn(
                        "absolute -right-0.5 -top-0.5 rounded-full ring-2 ring-[#090909]",
                        statusDotClass(node.status)
                      )}
                      style={{
                        width: Math.max(6, 8 * scale.factor),
                        height: Math.max(6, 8 * scale.factor),
                      }}
                      title={statusLabel(node.status)}
                    />
                  </motion.span>
                  <span
                    className="w-full truncate font-medium leading-tight text-zinc-200"
                    style={{ fontSize: scale.nameFont }}
                  >
                    {node.name}
                  </span>
                  {scale.showDomain && (
                    <span className="w-full truncate font-mono text-[8px] leading-tight text-zinc-500 sm:text-[9px]">
                      {node.domain}
                    </span>
                  )}
                  {scale.showStatus && (
                    <span className="font-mono text-[8px] uppercase tracking-wider text-zinc-600">
                      {statusLabel(node.status)}
                    </span>
                  )}
                </motion.button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
