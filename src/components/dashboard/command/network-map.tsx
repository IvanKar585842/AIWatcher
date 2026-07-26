"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Cpu, Globe2 } from "lucide-react";
import { CreateMonitorDialog } from "@/components/dashboard/create-monitor-dialog";
import { WebsiteLogo } from "@/components/dashboard/website-logo";
import { cn, formatRelativeTime, getDomainFromUrl } from "@/lib/utils";

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
  /** 1 = few monitors, ~0.32 = dense */
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
 * Also shrinks so node cards fit the chord length of a bounded circle.
 */
export function computeMapScale(count: number): MapScale {
  const n = Math.max(0, count);
  // Piecewise map → factor in [0.42, 1]
  let factor = 1;
  if (n <= 5) factor = 1;
  else if (n <= 20) factor = 1 - ((n - 5) / 15) * 0.28; // → 0.72
  else if (n <= 50) factor = 0.72 - ((n - 20) / 30) * 0.18; // → 0.54
  else factor = clamp(0.54 - ((n - 50) / 80) * 0.12, 0.42, 0.54);

  // Fit cards to arc chord on the ring radius this count will actually use
  if (n >= 2) {
    const density = clamp((n - 1) / 18, 0, 1);
    const approxR = 110 + 120 * (0.28 + 0.72 * density);
    const chord = 2 * approxR * Math.sin(Math.PI / n);
    const targetCard = clamp(chord * 0.9, 36, 136);
    const chordFactor = targetCard / 136;
    factor = Math.min(factor, clamp(chordFactor, 0.32, 1));
  }

  const iconBox = Math.round(clamp(40 * factor, 18, 40));
  const logoSize = Math.round(clamp(22 * factor, 10, 22));
  const coreOuter = Math.round(clamp(64 * factor, 30, 64));
  const coreInner = Math.round(clamp(44 * factor, 22, 44));
  const coreLogo = Math.round(clamp(28 * factor, 14, 28));
  const coreCpu = Math.round(clamp(20 * factor, 11, 20));

  return {
    factor,
    iconBox,
    logoSize,
    cardMaxW: Math.round(clamp(136 * factor, 40, 136)),
    showDomain: n <= 14,
    showStatus: n <= 10,
    nameFont: clamp(11 * factor, 7, 11),
    coreOuter,
    coreInner,
    coreLogo,
    coreCpu,
    // SVG radii follow the visible HTML core so chip sits inside the glow
    glowR: coreOuter * 0.82,
    coreR: coreOuter / 2,
    labelGap: Math.round(clamp(18 * factor, 8, 18)),
    pulseR: 18 * factor,
  };
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

export type RadialLayoutPoint = { x: number; y: number; angle: number; radius: number };

/**
 * Even circular layout around a fixed center.
 * Angle = (2π / count) * index (offset −π/2 so index 0 sits at top).
 * Radius grows with count but never exceeds container bounds.
 */
export function calculateRadialLayout(
  count: number,
  scale: MapScale,
  opts?: { cx?: number; cy?: number; viewW?: number; viewH?: number }
): RadialLayoutPoint[] {
  if (count <= 0) return [];

  const cx = opts?.cx ?? CX;
  const cy = opts?.cy ?? CY;
  const viewW = opts?.viewW ?? VIEW_W;
  const viewH = opts?.viewH ?? VIEW_H;

  // Approximate node card height (icon + labels + padding)
  const cardH =
    scale.iconBox +
    10 +
    scale.nameFont +
    (scale.showDomain ? 12 : 0) +
    (scale.showStatus ? 11 : 0);
  const halfW = scale.cardMaxW / 2;
  const halfH = cardH / 2;

  // Keep cards fully inside the map; extra room for overlays
  const padX = halfW + 10;
  const padTop = halfH + 36;
  const padBottom = halfH + 52;

  const maxRadius = Math.max(
    40,
    Math.min(cx - padX, viewW - cx - padX, cy - padTop, viewH - cy - padBottom)
  );

  // Clear of AI Core (+ label) and neighboring nodes
  const coreClearance =
    scale.coreOuter / 2 + scale.labelGap + 14 + scale.iconBox / 2 + 10 * scale.factor;
  const minRadius = Math.min(maxRadius, Math.max(coreClearance, 72 * scale.factor + 28));

  // Arc spacing: chord ≈ node footprint along the circumference
  const footprint = Math.max(scale.iconBox, scale.cardMaxW * 0.55) + 14 * scale.factor;
  const radiusForSpacing = count <= 1 ? minRadius : (count * footprint) / (2 * Math.PI);

  // Few monitors → tighter ring; many → push toward max (still clamped)
  const density = clamp((count - 1) / 18, 0, 1);
  const preferred = minRadius + (maxRadius - minRadius) * (0.28 + 0.72 * density);
  const radius = clamp(Math.max(preferred, radiusForSpacing), minRadius, maxRadius);

  return Array.from({ length: count }, (_, index) => {
    const angle = (2 * Math.PI * index) / count - Math.PI / 2;
    return {
      x: cx + Math.cos(angle) * radius,
      y: cy + Math.sin(angle) * radius,
      angle,
      radius,
    };
  });
}

function layoutNodes(
  monitors: NetworkMonitor[],
  scale: MapScale,
  pulseId: string | null
): NodePosition[] {
  const points = calculateRadialLayout(monitors.length, scale);

  return monitors.map((m, i) => {
    const p = points[i]!;
    return {
      id: m.id,
      name: m.name,
      url: m.url,
      faviconUrl: m.faviconUrl,
      domain: getDomainFromUrl(m.url),
      x: p.x,
      y: p.y,
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
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setReduceMotion(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  useEffect(() => {
    if (reduceMotion) return;
    const id = setInterval(() => setTick((t) => t + 1), 3000);
    return () => clearInterval(id);
  }, [reduceMotion]);

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

  const recentChangeCount = useMemo(
    () => monitors.filter((m) => isRecentlyChanged(m.lastChangedAt)).length,
    [monitors]
  );
  const activeCount = useMemo(
    () => monitors.filter((m) => m.status === "ACTIVE").length,
    [monitors]
  );

  return (
    <div
      className="relative min-h-[420px] w-full overflow-hidden rounded-2xl border border-white/[0.06] bg-[#060606] sm:min-h-[520px] lg:min-h-[640px]"
      data-tour="global-map"
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(34,211,238,0.06),transparent_65%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_bottom,transparent_70%,rgba(0,0,0,0.55))]" />

      <div className="absolute left-4 top-4 z-10 sm:left-5">
        <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-cyan-500/70">
          Intelligence grid
        </p>
        <h3 className="mt-1 text-sm font-medium text-zinc-200 sm:text-base">
          Global Monitor Map
        </h3>
        <p className="mt-1 max-w-[240px] text-[11px] leading-relaxed text-zinc-600 sm:max-w-xs">
          {monitors.length === 0
            ? "Your monitored sites appear around the AI Core."
            : `${activeCount} active · ${recentChangeCount} changed in the last hour`}
        </p>
        {selected && (
          <p className="mt-1 max-w-[200px] truncate font-mono text-[10px] text-cyan-500/80 sm:max-w-xs">
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

              {nodes.map((node, i) => {
                const isHot = node.pulsing || selectedId === node.id;
                const scanDur = 2.6 + (i % 7) * 0.32;
                const scanDelay = (i % 11) * 0.18;
                const pulseR = Math.max(1.6, 2.4 * scale.factor);
                // Slight curve so spokes don’t look like a flat star; ends stay on centers
                const dx = node.x - core.x;
                const dy = node.y - core.y;
                const len = Math.hypot(dx, dy) || 1;
                const bend = Math.min(16 * scale.factor, len * 0.09);
                const cpx = (core.x + node.x) / 2 + (-dy / len) * bend;
                const cpy = (core.y + node.y) / 2 + (dx / len) * bend;
                const pathD = `M${core.x},${core.y} Q${cpx},${cpy} ${node.x},${node.y}`;
                return (
                  <g key={`line-${node.id}`}>
                    <motion.path
                      initial={false}
                      d={pathD}
                      fill="none"
                      stroke={
                        selectedId === node.id
                          ? "rgba(34,211,238,0.55)"
                          : node.pulsing
                            ? "rgba(34,211,238,0.42)"
                            : "rgba(56,189,248,0.16)"
                      }
                      strokeWidth={isHot ? 1.45 : 0.9}
                      strokeLinecap="round"
                      animate={
                        reduceMotion
                          ? { d: pathD, strokeOpacity: isHot ? 0.45 : 0.18 }
                          : {
                              d: pathD,
                              strokeOpacity: isHot
                                ? [0.28, 0.72, 0.28]
                                : [0.12, 0.24, 0.12],
                            }
                      }
                      transition={
                        reduceMotion
                          ? { d: { duration: 0 }, strokeOpacity: { duration: 0 } }
                          : {
                              d: { type: "spring", stiffness: 220, damping: 28 },
                              strokeOpacity: {
                                duration: isHot ? 2 : 3.2,
                                repeat: Infinity,
                                ease: "easeInOut",
                              },
                            }
                      }
                    />
                    {!reduceMotion && (
                      <circle
                        r={pulseR}
                        fill={isHot ? "#67e8f9" : "#22d3ee"}
                        filter="url(#nodeGlow)"
                        opacity={0}
                      >
                        <animateMotion
                          dur={`${scanDur}s`}
                          begin={`${scanDelay}s`}
                          repeatCount="indefinite"
                          path={pathD}
                        />
                        <animate
                          attributeName="opacity"
                          values="0;0.95;0.85;0"
                          keyTimes="0;0.1;0.82;1"
                          dur={`${scanDur}s`}
                          begin={`${scanDelay}s`}
                          repeatCount="indefinite"
                        />
                      </circle>
                    )}
                    {!reduceMotion && node.pulsing && (
                      <circle
                        r={pulseR * 1.25}
                        fill="#a5f3fc"
                        filter="url(#nodeGlow)"
                        opacity={0}
                      >
                        <animateMotion
                          dur={`${Math.max(1.6, scanDur * 0.72)}s`}
                          begin={`${scanDelay + 0.55}s`}
                          repeatCount="indefinite"
                          path={pathD}
                        />
                        <animate
                          attributeName="opacity"
                          values="0;1;0"
                          keyTimes="0;0.35;1"
                          dur={`${Math.max(1.6, scanDur * 0.72)}s`}
                          begin={`${scanDelay + 0.55}s`}
                          repeatCount="indefinite"
                        />
                      </circle>
                    )}
                  </g>
                );
              })}

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

            {/* AI Core — chip perfectly centered; label sits outside without shifting the icon */}
            <div className="pointer-events-none absolute inset-0 z-[5]">
              <div
                className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
                style={{ width: scale.coreOuter, height: scale.coreOuter }}
              >
                <motion.div
                  className="relative flex h-full w-full items-center justify-center"
                  animate={reduceMotion ? undefined : { scale: [1, 1.03, 1] }}
                  transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
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
                        className="flex items-center justify-center rounded-full border border-cyan-400/45 bg-cyan-500/15"
                        style={{ width: scale.coreInner, height: scale.coreInner }}
                      >
                        <Cpu
                          className="text-cyan-300"
                          style={{ width: scale.coreCpu, height: scale.coreCpu }}
                          aria-hidden
                        />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              </div>
              <p
                className="absolute left-1/2 -translate-x-1/2 font-mono tracking-[0.3em] text-sky-300/70"
                style={{
                  top: `calc(50% + ${scale.coreOuter / 2 + scale.labelGap}px)`,
                  fontSize: clamp(8 * scale.factor, 7, 10),
                }}
              >
                AI CORE
              </p>
            </div>

            {nodes.map((node, i) => {
              const isSelected = selectedId === node.id;
              const leftPct = (node.x / VIEW_W) * 100;
              const topPct = (node.y / VIEW_H) * 100;
              return (
                <motion.button
                  key={node.id}
                  type="button"
                  initial={{ opacity: 0, scale: 0.6, left: `${leftPct}%`, top: `${topPct}%` }}
                  animate={{
                    opacity: 1,
                    scale: 1,
                    left: `${leftPct}%`,
                    top: `${topPct}%`,
                    width: scale.cardMaxW,
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
                    left: { type: "spring", stiffness: 220, damping: 28 },
                    top: { type: "spring", stiffness: 220, damping: 28 },
                    width: { type: "spring", stiffness: 280, damping: 30 },
                    y:
                      monitors.length <= 24
                        ? { duration: 3 + (i % 3), repeat: Infinity, ease: "easeInOut" }
                        : undefined,
                  }}
                  className={cn(
                    "absolute z-10 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-0.5 rounded-xl border px-1 py-1 text-center backdrop-blur-sm transition-[border-color,background-color,box-shadow] duration-300 sm:px-1.5 sm:py-1.5",
                    isSelected
                      ? "border-cyan-400/50 bg-cyan-500/15 shadow-[0_0_20px_-6px_rgba(34,211,238,0.5)]"
                      : "border-white/[0.08] bg-[#090909]/85 hover:border-cyan-400/30 hover:bg-cyan-500/[0.08]",
                    node.pulsing && !isSelected && "border-cyan-400/35"
                  )}
                  style={{
                    maxWidth: scale.cardMaxW,
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

      {monitors.length > 0 && (
        <div className="absolute bottom-3 left-3 right-3 z-20 sm:bottom-4 sm:left-4 sm:right-4">
          <div className="rounded-xl border border-white/[0.08] bg-[#090909]/90 px-3 py-2.5 backdrop-blur-md sm:px-4">
            {selected ? (
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-zinc-100">{selected.name}</p>
                  <p className="truncate font-mono text-[10px] text-zinc-500">
                    {getDomainFromUrl(selected.url)} · {statusLabel(selected.status)}
                    {selected.lastChangedAt
                      ? ` · last change ${formatRelativeTime(selected.lastChangedAt)}`
                      : ""}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[10px] uppercase tracking-wider text-zinc-600">
                    {selected._count?.changes ?? 0} changes
                  </span>
                  <button
                    type="button"
                    onClick={() => router.push(`/dashboard/monitors/${selected.id}`)}
                    className="rounded-full border border-cyan-400/25 bg-cyan-500/10 px-3 py-1.5 text-[11px] text-cyan-100 transition-colors hover:border-cyan-400/40"
                  >
                    Open monitor
                  </button>
                </div>
              </div>
            ) : (
              <p className="text-center text-[11px] text-zinc-500 sm:text-left">
                Select a site for quick intel · double-click to open · pulsing nodes changed
                recently
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
