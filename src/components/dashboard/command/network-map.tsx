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
  angle: number;
  radius: number;
  status: string;
  active: boolean;
  recentlyChanged: boolean;
  changes: number;
}

/** Responsive layout metrics from monitor density. */
export type MapScale = {
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
};

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

/**
 * Node / core scale: fewer monitors → larger nodes; denser → smaller.
 */
export function computeMapScale(count: number): MapScale {
  const n = Math.max(0, count);
  let factor = 1;
  if (n <= 5) factor = 1;
  else if (n <= 10) factor = 0.88;
  else if (n <= 20) factor = 0.68;
  else if (n <= 40) factor = 0.48;
  else factor = clamp(0.48 - ((n - 40) / 60) * 0.12, 0.34, 0.48);

  // Fit card width to chord on the expected ring radius
  if (n >= 2) {
    const targetR = targetRingRadius(n);
    const chord = 2 * targetR * Math.sin(Math.PI / n);
    factor = Math.min(factor, clamp((chord * 0.85) / 120, 0.34, 1));
  }

  const iconBox = Math.round(clamp(40 * factor, 16, 40));
  const logoSize = Math.round(clamp(22 * factor, 10, 22));
  const coreOuter = Math.round(clamp(64 * factor, 32, 64));
  const coreInner = Math.round(clamp(44 * factor, 24, 44));
  const coreLogo = Math.round(clamp(28 * factor, 14, 28));
  const coreCpu = Math.round(clamp(20 * factor, 12, 20));

  return {
    factor,
    iconBox,
    logoSize,
    cardMaxW: Math.round(clamp(120 * factor, 36, 120)),
    showDomain: n <= 12,
    showStatus: n <= 8,
    nameFont: clamp(11 * factor, 7, 11),
    coreOuter,
    coreInner,
    coreLogo,
    coreCpu,
    glowR: coreOuter * 0.82,
    coreR: coreOuter / 2,
    labelGap: Math.round(clamp(16 * factor, 8, 16)),
  };
}

/** Spec tiers for ring radius (viewBox units ≈ px at 1:1). */
function targetRingRadius(count: number): number {
  if (count <= 5) return 160;
  if (count <= 10) return 210;
  if (count <= 20) return 260;
  return 260 + (count - 20) * 3.5;
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

/** Square viewBox — true circle symmetry around the AI Core. */
const VIEW = 800;
const CX = VIEW / 2;
const CY = VIEW / 2;

export type RadialLayoutPoint = { x: number; y: number; angle: number; radius: number };

/**
 * Perfect circular ring around a fixed center.
 * angle = (2π / count) * index
 * x = cx + r * cos(angle)
 * y = cy + r * sin(angle)
 */
export function calculateRadialLayout(
  count: number,
  scale: MapScale,
  opts?: { cx?: number; cy?: number; view?: number }
): RadialLayoutPoint[] {
  if (count <= 0) return [];

  const cx = opts?.cx ?? CX;
  const cy = opts?.cy ?? CY;
  const view = opts?.view ?? VIEW;

  const cardH =
    scale.iconBox +
    8 +
    scale.nameFont +
    (scale.showDomain ? 11 : 0) +
    (scale.showStatus ? 10 : 0);
  const halfW = scale.cardMaxW / 2;
  const halfH = cardH / 2;
  const nodePad = Math.max(halfW, halfH) + 6;

  // Largest radius that keeps every node fully inside the container
  const maxInside = Math.max(
    80,
    Math.min(cx, cy, view - cx, view - cy) - nodePad
  );

  // Ring occupies ~75–85% of available map space, following tier targets
  const bandMin = maxInside * 0.75;
  const bandMax = maxInside * 0.85;
  const tier = targetRingRadius(count);

  let radius = clamp(tier, bandMin, bandMax);
  // Prefer the tier when it already sits inside the safe band
  if (tier >= bandMin && tier <= maxInside) {
    radius = Math.min(tier, bandMax);
  }
  radius = Math.min(radius, maxInside);

  return Array.from({ length: count }, (_, index) => {
    const angle = ((2 * Math.PI) / count) * index;
    return {
      x: cx + radius * Math.cos(angle),
      y: cy + radius * Math.sin(angle),
      angle,
      radius,
    };
  });
}

function layoutNodes(
  monitors: NetworkMonitor[],
  scale: MapScale
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
      angle: p.angle,
      radius: p.radius,
      status: m.status,
      active: m.status === "ACTIVE",
      recentlyChanged: isRecentlyChanged(m.lastChangedAt),
      changes: m._count?.changes ?? 0,
    };
  });
}

export function NetworkMap({ monitors }: { monitors: NetworkMonitor[] }) {
  const router = useRouter();
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
    if (selectedId && !monitors.some((m) => m.id === selectedId)) {
      setSelectedId(null);
    }
  }, [monitors, selectedId]);

  const selected = useMemo(
    () => monitors.find((m) => m.id === selectedId) ?? null,
    [monitors, selectedId]
  );

  const scale = useMemo(() => computeMapScale(monitors.length), [monitors.length]);
  const nodes = useMemo(() => layoutNodes(monitors, scale), [monitors, scale]);
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
          <div className="relative aspect-square h-auto w-full max-h-[min(640px,92vw)] min-w-0">
            <svg
              viewBox={`0 0 ${VIEW} ${VIEW}`}
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
                  <feGaussianBlur stdDeviation="2.5" result="blur" />
                  <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>

              {Array.from({ length: 16 }).map((_, row) =>
                Array.from({ length: 16 }).map((__, col) => (
                  <circle
                    key={`${row}-${col}`}
                    cx={40 + col * 48}
                    cy={40 + row * 48}
                    r="0.6"
                    fill="rgba(125,211,252,0.08)"
                  />
                ))
              )}

              {nodes.map((node, i) => {
                const isSelected = selectedId === node.id;
                const pathD = `M${core.x},${core.y} L${node.x},${node.y}`;
                const pulseDur = 1.5 + (i % 5) * 0.1;
                const pulseDelay = (i % 8) * 0.18;
                const pulseR = Math.max(1.8, 2.6 * scale.factor);

                return (
                  <g key={`line-${node.id}`}>
                    <motion.line
                      initial={false}
                      x1={core.x}
                      y1={core.y}
                      animate={{
                        x2: node.x,
                        y2: node.y,
                        strokeOpacity: isSelected
                          ? 0.55
                          : node.active
                            ? 0.32
                            : 0.14,
                      }}
                      transition={{
                        x2: { type: "spring", stiffness: 220, damping: 28 },
                        y2: { type: "spring", stiffness: 220, damping: 28 },
                        strokeOpacity: { duration: 0.35 },
                      }}
                      stroke={
                        isSelected
                          ? "rgba(34,211,238,0.65)"
                          : node.active
                            ? "rgba(34,211,238,0.35)"
                            : "rgba(56,189,248,0.14)"
                      }
                      strokeWidth={isSelected || node.active ? 1.35 : 0.85}
                      strokeLinecap="round"
                    />

                    {/* Energy pulse: ACTIVE monitors only */}
                    {!reduceMotion && node.active && (
                      <circle
                        r={pulseR}
                        fill={node.recentlyChanged ? "#a5f3fc" : "#22d3ee"}
                        filter="url(#nodeGlow)"
                        opacity={0}
                      >
                        <animateMotion
                          dur={`${pulseDur}s`}
                          begin={`${pulseDelay}s`}
                          repeatCount="indefinite"
                          path={pathD}
                        />
                        <animate
                          attributeName="opacity"
                          values="0;1;0.9;0"
                          keyTimes="0;0.12;0.78;1"
                          dur={`${pulseDur}s`}
                          begin={`${pulseDelay}s`}
                          repeatCount="indefinite"
                        />
                      </circle>
                    )}
                  </g>
                );
              })}

              <motion.g
                animate={reduceMotion ? undefined : { scale: [1, 1.04, 1] }}
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

            {/* AI Core — exact center of the map */}
            <div className="pointer-events-none absolute inset-0 z-[5]">
              <div
                className="absolute"
                style={{
                  left: "50%",
                  top: "50%",
                  width: scale.coreOuter,
                  height: scale.coreOuter,
                  marginLeft: -scale.coreOuter / 2,
                  marginTop: -scale.coreOuter / 2,
                }}
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
                className="absolute font-mono tracking-[0.3em] text-sky-300/70"
                style={{
                  left: "50%",
                  top: `calc(50% + ${scale.coreOuter / 2 + scale.labelGap}px)`,
                  marginLeft: "-3.5em",
                  width: "7em",
                  textAlign: "center",
                  fontSize: clamp(8 * scale.factor, 7, 10),
                }}
              >
                AI CORE
              </p>
            </div>

            {nodes.map((node, i) => {
              const isSelected = selectedId === node.id;
              const leftPct = (node.x / VIEW) * 100;
              const topPct = (node.y / VIEW) * 100;
              return (
                <motion.button
                  key={node.id}
                  type="button"
                  initial={{ opacity: 0, scale: 0.6, x: "-50%", y: "-50%" }}
                  animate={{
                    opacity: 1,
                    scale: 1,
                    left: `${leftPct}%`,
                    top: `${topPct}%`,
                    width: scale.cardMaxW,
                    x: "-50%",
                    y: "-50%",
                  }}
                  transition={{
                    opacity: { delay: Math.min(i * 0.03, 0.5), duration: 0.25 },
                    scale: {
                      delay: Math.min(i * 0.03, 0.5),
                      type: "spring",
                      stiffness: 320,
                      damping: 28,
                    },
                    left: { type: "spring", stiffness: 220, damping: 28 },
                    top: { type: "spring", stiffness: 220, damping: 28 },
                    width: { type: "spring", stiffness: 280, damping: 30 },
                  }}
                  className={cn(
                    "absolute z-10 flex flex-col items-center gap-0.5 rounded-xl border px-1 py-1 text-center backdrop-blur-sm transition-[border-color,background-color,box-shadow] duration-300 sm:px-1.5 sm:py-1.5",
                    isSelected
                      ? "border-cyan-400/50 bg-cyan-500/15 shadow-[0_0_20px_-6px_rgba(34,211,238,0.5)]"
                      : "border-white/[0.08] bg-[#090909]/85 hover:border-cyan-400/30 hover:bg-cyan-500/[0.08]",
                    node.recentlyChanged && !isSelected && "border-cyan-400/35",
                    !node.active && "opacity-80"
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
                Select a site for quick intel · double-click to open · energy pulses flow to
                active monitors
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
