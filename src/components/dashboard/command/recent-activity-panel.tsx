"use client";

import { memo, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { Bell, Brain, Sparkles } from "lucide-react";
import { formatRelativeTime } from "@/lib/utils";
import { EmptyState } from "./dashboard-skeletons";

export interface ActivityChange {
  id: string;
  summary: string;
  emoji: string;
  importance: string;
  createdAt: string;
  monitor: { name: string; url: string };
}

export interface ActivityNotification {
  id: string;
  channel: string;
  status: string;
  createdAt: string;
  change: {
    id: string;
    summary: string;
    emoji: string;
    monitor: { name: string };
  };
}

type Tab = "detections" | "notifications";

const STATUS_STYLES: Record<string, string> = {
  SENT: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
  PENDING: "border-amber-500/30 bg-amber-500/10 text-amber-300",
  FAILED: "border-red-500/30 bg-red-500/10 text-red-300",
};

const IMPORTANCE_STYLES: Record<string, string> = {
  CRITICAL: "border-red-400/30 bg-red-500/10 text-red-300",
  HIGH: "border-amber-400/30 bg-amber-500/10 text-amber-300",
  MEDIUM: "border-cyan-400/20 bg-cyan-500/10 text-cyan-300",
  LOW: "border-white/10 bg-white/[0.04] text-zinc-500",
};

function hostFromUrl(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

export const RecentActivityPanel = memo(function RecentActivityPanel({
  changes,
  notifications,
}: {
  changes: ActivityChange[];
  notifications: ActivityNotification[];
}) {
  const [tab, setTab] = useState<Tab>("detections");

  const tabs: { id: Tab; label: string; short: string; count: number; icon: React.ElementType }[] = [
    { id: "detections", label: "AI Detections", short: "Detections", count: changes.length, icon: Brain },
    { id: "notifications", label: "Notifications", short: "Alerts", count: notifications.length, icon: Bell },
  ];

  return (
    <div className="flex w-full min-w-0 flex-col rounded-2xl border border-white/[0.06] bg-white/[0.02] lg:h-[560px] lg:max-h-[560px] lg:overflow-hidden">
      <div className="shrink-0 border-b border-white/[0.06] px-3 py-3 sm:px-5 sm:py-4">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-cyan-500/70">
              Recent Activity
            </p>
            <h3 className="mt-1 text-sm font-medium text-zinc-100">Intelligence Feed</h3>
            <p className="mt-0.5 hidden text-[11px] text-zinc-500 sm:block">
              Changes WatchFlowing understands — not just detects
            </p>
          </div>
          <Sparkles className="h-4 w-4 shrink-0 text-cyan-500/40" />
        </div>

        <div className="mt-3 flex gap-1 rounded-lg border border-white/[0.06] bg-black/30 p-1 sm:mt-4">
          {tabs.map((t) => {
            const Icon = t.icon;
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={`relative flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-2 text-xs font-medium transition-colors ${
                  active ? "text-cyan-100" : "text-zinc-500 hover:text-zinc-300"
                }`}
              >
                {active && (
                  <motion.div
                    layoutId="activity-tab"
                    className="absolute inset-0 rounded-md border border-cyan-500/20 bg-cyan-500/10"
                    transition={{ type: "spring", stiffness: 400, damping: 30 }}
                  />
                )}
                <Icon className="relative h-3.5 w-3.5 shrink-0" />
                <span className="relative truncate sm:hidden">{t.short}</span>
                <span className="relative hidden truncate sm:inline">{t.label}</span>
                <span className="relative font-mono text-[10px] text-zinc-600">{t.count}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Mobile: expand with page scroll. Desktop: internal scroll. */}
      <div className="min-h-0 lg:flex-1 lg:overflow-y-auto">
        <AnimatePresence mode="wait">
          {tab === "detections" ? (
            <motion.div
              key="detections"
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 12 }}
              transition={{ duration: 0.2 }}
              className="p-3 sm:p-4"
            >
              {changes.length === 0 ? (
                <EmptyState
                  icon={Brain}
                  title="Your AI monitoring feed will appear here"
                  description="WatchFlowing will analyze important changes and explain what requires attention — so you never chase noise."
                />
              ) : (
                <div className="space-y-2">
                  {changes.map((change, i) => (
                    <motion.div
                      key={change.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.03 }}
                    >
                      <Link
                        href={`/dashboard/changes/${change.id}`}
                        className="group block min-h-[4.5rem] rounded-xl border border-white/[0.05] bg-black/20 p-3 transition-colors hover:border-cyan-500/20 hover:bg-cyan-500/[0.04] active:bg-white/[0.04]"
                      >
                        <div className="flex items-start gap-3">
                          <span className="mt-0.5 text-base leading-none">{change.emoji}</span>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span
                                className={`inline-flex rounded-full border px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider ${
                                  IMPORTANCE_STYLES[change.importance] ??
                                  IMPORTANCE_STYLES.LOW
                                }`}
                              >
                                {change.importance || "LOW"}
                              </span>
                              <span className="ml-auto shrink-0 font-mono text-[10px] text-zinc-600">
                                {formatRelativeTime(change.createdAt)}
                              </span>
                            </div>
                            <p className="mt-1.5 truncate text-sm font-medium text-zinc-100 group-hover:text-cyan-100">
                              {change.monitor.name}
                            </p>
                            <p className="truncate font-mono text-[10px] text-zinc-600">
                              {hostFromUrl(change.monitor.url)}
                            </p>
                            <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-zinc-400">
                              {change.summary}
                            </p>
                          </div>
                        </div>
                      </Link>
                    </motion.div>
                  ))}
                </div>
              )}
            </motion.div>
          ) : (
            <motion.div
              key="notifications"
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -12 }}
              transition={{ duration: 0.2 }}
              className="p-3 sm:p-4"
            >
              {notifications.length === 0 ? (
                <EmptyState
                  icon={Bell}
                  title="Your intelligence alerts are ready"
                  description="When something important changes, WatchFlowing will deliver a clear AI summary here — via email, Telegram, or in-app."
                />
              ) : (
                <div className="space-y-2">
                  {notifications.map((notif, i) => (
                    <motion.div
                      key={notif.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.03 }}
                    >
                      <Link
                        href={`/dashboard/changes/${notif.change.id}`}
                        className="group flex min-h-[4.5rem] items-start gap-3 rounded-xl border border-white/[0.05] bg-black/20 p-3 transition-colors hover:border-cyan-500/20 hover:bg-cyan-500/[0.04]"
                      >
                        <span className="mt-0.5 text-base">{notif.change.emoji}</span>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="truncate text-sm font-medium text-zinc-200 group-hover:text-cyan-100">
                              {notif.change.monitor.name}
                            </p>
                            <span
                              className={`ml-auto shrink-0 rounded-full border px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider ${
                                STATUS_STYLES[notif.status] ?? STATUS_STYLES.PENDING
                              }`}
                            >
                              {notif.status}
                            </span>
                          </div>
                          <p className="mt-1 line-clamp-2 text-xs text-zinc-400">
                            {notif.change.summary}
                          </p>
                          <p className="mt-1.5 font-mono text-[10px] text-zinc-600">
                            via {notif.channel} · {formatRelativeTime(notif.createdAt)}
                          </p>
                        </div>
                      </Link>
                    </motion.div>
                  ))}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
});
