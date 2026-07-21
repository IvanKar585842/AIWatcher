"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  MouseParallaxLayer,
  usePrefersReducedMotion,
} from "@/components/landing/os/mouse-parallax";
import { ParticleField } from "@/components/landing/os/particle-field";
import { cn } from "@/lib/utils";

type EventType =
  | "Website updated"
  | "Docs updated"
  | "New job detected"
  | "Scholarship added"
  | "Policy changed";

interface MonitorSite {
  id: string;
  name: string;
  domain: string;
  x: number;
  y: number;
  color: string;
}

interface LiveEvent {
  id: string;
  siteId: string;
  message: EventType;
  emoji: string;
}

const SITES: MonitorSite[] = [
  { id: "stripe", name: "Stripe Pricing", domain: "stripe.com/pricing", x: 12, y: 18, color: "#38bdf8" },
  { id: "mit", name: "MIT Careers", domain: "careers.mit.edu", x: 78, y: 14, color: "#22d3ee" },
  { id: "docs", name: "Product Docs", domain: "docs.example.com", x: 86, y: 52, color: "#67e8f9" },
  { id: "gov", name: "EU Policy", domain: "europa.eu/policy", x: 72, y: 82, color: "#7dd3fc" },
  { id: "uni", name: "Harvard Aid", domain: "harvard.edu/finaid", x: 10, y: 72, color: "#06b6d4" },
  { id: "github", name: "GitHub Releases", domain: "github.com/org/repo", x: 42, y: 8, color: "#0ea5e9" },
];

const EVENTS: { message: EventType; emoji: string }[] = [
  { message: "Website updated", emoji: "◆" },
  { message: "Docs updated", emoji: "◈" },
  { message: "New job detected", emoji: "◎" },
  { message: "Scholarship added", emoji: "✦" },
  { message: "Policy changed", emoji: "⚡" },
];

const FEED = [
  { time: "now", text: "Documentation section updated on docs hub", type: "docs" },
  { time: "2m", text: "New job: Senior ML Engineer at MIT", type: "job" },
  { time: "5m", text: "Policy section updated on europa.eu", type: "policy" },
  { time: "12m", text: "Scholarship deadline added", type: "scholarship" },
];

/** Animated hero visual only — LCP copy lives in the server LandingPage. */
export function HeroDashboardVisual() {
  const reducedMotion = usePrefersReducedMotion();
  const [activeSite, setActiveSite] = useState<string | null>(null);
  const [activeLine, setActiveLine] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<LiveEvent[]>([]);
  const [feedIndex, setFeedIndex] = useState(0);
  const timeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  const triggerEvent = useCallback(() => {
    const site = SITES[Math.floor(Math.random() * SITES.length)];
    const evt = EVENTS[Math.floor(Math.random() * EVENTS.length)];
    const id = `${Date.now()}-${Math.random()}`;

    setActiveSite(site.id);
    setActiveLine(site.id);
    setNotifications((prev) => [...prev.slice(-3), { id, siteId: site.id, ...evt }]);

    timeoutsRef.current.push(
      setTimeout(() => setActiveLine(null), 1400),
      setTimeout(() => setActiveSite(null), 2200),
      setTimeout(() => {
        setNotifications((prev) => prev.filter((n) => n.id !== id));
      }, 4500)
    );
  }, []);

  useEffect(() => {
    if (reducedMotion) return;
    triggerEvent();
    const interval = setInterval(triggerEvent, 3200);
    return () => {
      clearInterval(interval);
      timeoutsRef.current.forEach(clearTimeout);
      timeoutsRef.current = [];
    };
  }, [triggerEvent, reducedMotion]);

  useEffect(() => {
    if (reducedMotion) return;
    const interval = setInterval(() => setFeedIndex((i) => (i + 1) % FEED.length), 3600);
    return () => clearInterval(interval);
  }, [reducedMotion]);

  const center = useMemo(() => ({ x: 50, y: 50 }), []);
  const lines = useMemo(
    () =>
      SITES.map((site) => ({
        id: site.id,
        x1: site.x,
        y1: site.y,
        x2: center.x,
        y2: center.y,
      })),
    [center]
  );

  return (
    <div className="relative">
      {!reducedMotion && <ParticleField density={0.00004} />}
      <MouseParallaxLayer depth={reducedMotion ? 0 : 10} className="perspective-[1200px]">
        <div className="relative mx-auto aspect-[16/10] w-full max-w-5xl rounded-2xl border border-white/[0.06] bg-[#0c0c0c]/80 p-1 shadow-[0_0_80px_-20px_rgba(34,211,238,0.25)] backdrop-blur-sm">
          <div className="relative h-full w-full overflow-hidden rounded-xl bg-[#080808]">
            <div className="flex items-center justify-between border-b border-white/[0.05] px-4 py-2.5">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-cyan-400/80" />
                <span className="h-2 w-2 rounded-full bg-zinc-600" />
                <span className="h-2 w-2 rounded-full bg-zinc-700" />
              </div>
              <span className="font-mono text-[10px] tracking-widest text-zinc-600">
                WatchFlowing_OS v1.0 · 6 MONITORS ACTIVE
              </span>
              <span className="font-mono text-[10px] text-cyan-500/80">LIVE</span>
            </div>

            <div className="relative h-[calc(100%-40px)] w-full">
              <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                {lines.map((line) => (
                  <line
                    key={line.id}
                    x1={line.x1}
                    y1={line.y1}
                    x2={line.x2}
                    y2={line.y2}
                    stroke={
                      activeLine === line.id ? "rgba(34,211,238,0.9)" : "rgba(56,189,248,0.12)"
                    }
                    strokeWidth={activeLine === line.id ? 0.35 : 0.15}
                  />
                ))}
              </svg>

              <div className="absolute left-1/2 top-1/2 z-20 -translate-x-1/2 -translate-y-1/2">
                <div className="relative flex h-20 w-20 items-center justify-center rounded-full border border-cyan-400/40 bg-cyan-500/10 shadow-[0_0_60px_rgba(34,211,238,0.35)] sm:h-24 sm:w-24">
                  <div className="text-center">
                    <p className="font-mono text-[9px] uppercase tracking-widest text-cyan-300/90">
                      Core
                    </p>
                    <p className="text-xs font-medium text-cyan-100">AI</p>
                  </div>
                </div>
              </div>

              {SITES.map((site) => (
                <div
                  key={site.id}
                  className="absolute z-10 w-[28%] min-w-[120px] max-w-[180px] sm:w-[22%]"
                  style={{
                    left: `${site.x}%`,
                    top: `${site.y}%`,
                    transform: "translate(-50%, -50%)",
                  }}
                >
                  <div
                    className={cn(
                      "rounded-lg border border-white/[0.06] bg-[#111111]/90 p-2.5 backdrop-blur-md sm:p-3",
                      activeSite === site.id && "border-cyan-400/40"
                    )}
                    style={
                      activeSite === site.id
                        ? { boxShadow: `0 0 30px ${site.color}55` }
                        : undefined
                    }
                  >
                    <div className="mb-1.5 flex items-center gap-1.5">
                      <span
                        className="h-1.5 w-1.5 rounded-full"
                        style={{
                          backgroundColor: site.color,
                          boxShadow: `0 0 8px ${site.color}`,
                        }}
                      />
                      <span className="truncate text-[10px] font-medium text-zinc-300 sm:text-xs">
                        {site.name}
                      </span>
                    </div>
                    <p className="truncate font-mono text-[9px] text-zinc-600">{site.domain}</p>
                  </div>
                </div>
              ))}

              {!reducedMotion && (
                <AnimatePresence>
                  {notifications.map((n) => {
                    const site = SITES.find((s) => s.id === n.siteId);
                    if (!site) return null;
                    return (
                      <motion.div
                        key={n.id}
                        initial={{ left: `${site.x}%`, top: `${site.y}%`, opacity: 0, scale: 0.6 }}
                        animate={{
                          left: "50%",
                          top: "50%",
                          opacity: [0, 1, 1, 0],
                          scale: [0.6, 1, 0.8, 0.4],
                        }}
                        transition={{ duration: 2.2, ease: "easeInOut" }}
                        className="pointer-events-none absolute z-30 -translate-x-1/2 -translate-y-1/2 whitespace-nowrap rounded-full border border-cyan-400/30 bg-cyan-500/15 px-3 py-1 font-mono text-[10px] text-cyan-200 backdrop-blur-md"
                      >
                        {n.emoji} {n.message}
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              )}

              <div className="absolute bottom-3 left-3 right-3 sm:right-auto sm:w-64">
                <div className="rounded-lg border border-white/[0.06] bg-[#0a0a0a]/90 p-3 backdrop-blur-md">
                  <p className="mb-2 font-mono text-[9px] uppercase tracking-widest text-zinc-600">
                    Activity
                  </p>
                  <p className="text-xs text-zinc-400">
                    <span className="font-mono text-cyan-500/80">{FEED[feedIndex].time}</span>
                    <span className="mx-2 text-zinc-700">·</span>
                    {FEED[feedIndex].text}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </MouseParallaxLayer>
    </div>
  );
}

/** @deprecated Use HeroDashboardVisual — kept for any residual imports */
export const HeroDashboard = HeroDashboardVisual;
