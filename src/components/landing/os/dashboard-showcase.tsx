"use client";

import { useRef, useState } from "react";
import { AnimatePresence, motion, useInView } from "framer-motion";

const TIMELINE = [
  { time: "14:32:01", site: "docs.example.com", change: "API auth section rewritten", importance: "HIGH" },
  { time: "14:28:44", site: "jobs.apple.com", change: "New role: Vision Pro Engineer", importance: "MEDIUM" },
  { time: "14:15:12", site: "harvard.edu/finaid", change: "Scholarship deadline extended", importance: "CRITICAL" },
  { time: "13:58:33", site: "company.com/legal", change: "Privacy Policy — Section 4.2 modified", importance: "HIGH" },
];

const CHART = [32, 45, 38, 62, 55, 78, 71, 89, 84, 95, 88, 102];

export function OsDashboardShowcase() {
  const ref = useRef<HTMLElement>(null);
  const inView = useInView(ref, { once: true, margin: "-15%" });
  const [activeWindow, setActiveWindow] = useState<"feed" | "timeline" | "chart">("feed");

  return (
    <section id="system" ref={ref} className="relative scroll-mt-24 overflow-hidden bg-[#090909] py-32">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_60%_40%_at_50%_100%,rgba(6,182,212,0.08),transparent)]" />

      <div className="relative mx-auto max-w-7xl px-4">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          className="mb-16 text-center"
        >
          <p className="mb-3 font-mono text-[11px] uppercase tracking-[0.35em] text-cyan-500/70">
            Website intelligence platform
          </p>
          <h2 className="text-3xl font-light text-zinc-100 md:text-4xl">
            Your monitoring command center
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-sm text-zinc-500">
            See detections, importance scores, and AI summaries in one place — built for teams that
            need clarity, not just change logs.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={inView ? { opacity: 1, scale: 1 } : {}}
          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
          className="relative mx-auto max-w-5xl rounded-2xl border border-white/[0.06] bg-[#0a0a0a] p-4 shadow-[0_40px_100px_-40px_rgba(0,0,0,0.8)]"
        >
          {/* Window tabs */}
          <div className="mb-4 flex gap-2">
            {(["feed", "timeline", "chart"] as const).map((w) => (
              <button
                key={w}
                onClick={() => setActiveWindow(w)}
                className={`rounded-md px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider transition-all ${
                  activeWindow === w
                    ? "bg-cyan-500/15 text-cyan-300"
                    : "text-zinc-600 hover:text-zinc-400"
                }`}
              >
                {w}
              </button>
            ))}
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            {/* Floating windows */}
            <motion.div
              layout
              className="md:col-span-2 rounded-xl border border-white/[0.05] bg-[#111] p-4"
            >
              <AnimatePresence mode="wait">
                {activeWindow === "feed" && (
                  <motion.div
                    key="feed"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                  >
                    <p className="mb-3 font-mono text-[10px] text-zinc-600">LIVE FEED</p>
                    <div className="space-y-2">
                      {TIMELINE.map((item, i) => (
                        <motion.div
                          key={item.time}
                          initial={{ opacity: 0, x: -12 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: i * 0.1 }}
                          className="flex items-start gap-3 rounded-lg border border-white/[0.04] bg-[#0a0a0a] p-3"
                        >
                          <span className="font-mono text-[10px] text-cyan-500/70">{item.time}</span>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-xs text-zinc-500">{item.site}</p>
                            <p className="text-sm text-zinc-300">{item.change}</p>
                          </div>
                          <span
                            className={`shrink-0 rounded px-1.5 py-0.5 font-mono text-[9px] ${
                              item.importance === "CRITICAL"
                                ? "bg-red-500/15 text-red-400"
                                : item.importance === "HIGH"
                                  ? "bg-amber-500/15 text-amber-400"
                                  : "bg-zinc-500/15 text-zinc-400"
                            }`}
                          >
                            {item.importance}
                          </span>
                        </motion.div>
                      ))}
                    </div>
                  </motion.div>
                )}

                {activeWindow === "timeline" && (
                  <motion.div key="timeline" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                    <p className="mb-4 font-mono text-[10px] text-zinc-600">CHANGE TIMELINE</p>
                    <div className="relative pl-6">
                      <div className="absolute bottom-0 left-2 top-0 w-px bg-gradient-to-b from-cyan-500/50 via-cyan-500/20 to-transparent" />
                      {TIMELINE.map((item, i) => (
                        <div key={i} className="relative mb-6">
                          <span className="absolute -left-[17px] top-1 h-2 w-2 rounded-full bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.6)]" />
                          <p className="text-xs text-zinc-500">{item.time}</p>
                          <p className="text-sm text-zinc-300">{item.change}</p>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}

                {activeWindow === "chart" && (
                  <motion.div key="chart" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                    <p className="mb-4 font-mono text-[10px] text-zinc-600">ACTIVITY — 12H</p>
                    <div className="flex h-40 items-end gap-1.5">
                      {CHART.map((h, i) => (
                        <motion.div
                          key={i}
                          initial={{ height: 0 }}
                          animate={{ height: `${h}%` }}
                          transition={{ delay: i * 0.05, duration: 0.5 }}
                          className="flex-1 rounded-t bg-gradient-to-t from-cyan-600/40 to-cyan-400/80"
                        />
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>

            {/* Notification center */}
            <div className="space-y-4">
              <motion.div
                animate={{ y: [0, -4, 0] }}
                transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                className="rounded-xl border border-cyan-500/20 bg-cyan-500/5 p-4"
              >
                <p className="font-mono text-[10px] text-cyan-500/80">NOTIFICATIONS</p>
                <p className="mt-2 text-2xl font-light text-cyan-200">3</p>
                <p className="text-xs text-zinc-600">unread alerts</p>
              </motion.div>

              <div className="rounded-xl border border-white/[0.05] bg-[#111] p-4">
                <p className="mb-3 font-mono text-[10px] text-zinc-600">AI SUMMARY</p>
                <p className="text-sm leading-relaxed text-zinc-400">
                  Stripe increased Pro pricing by 25%. Competitor positioning may shift within 48h.
                </p>
              </div>

              <div className="rounded-xl border border-white/[0.05] bg-[#111] p-4">
                <p className="mb-2 font-mono text-[10px] text-zinc-600">MONITORS</p>
                <p className="text-3xl font-light text-zinc-200">24</p>
                <p className="text-xs text-emerald-500/80">all systems nominal</p>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
