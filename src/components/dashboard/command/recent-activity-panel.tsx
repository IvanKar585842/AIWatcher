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

export const RecentActivityPanel = memo(function RecentActivityPanel({
  changes,
  notifications,
}: {
  changes: ActivityChange[];
  notifications: ActivityNotification[];
}) {
  const [tab, setTab] = useState<Tab>("detections");

  const tabs: { id: Tab; label: string; count: number; icon: React.ElementType }[] = [
    { id: "detections", label: "AI Detections", count: changes.length, icon: Brain },
    { id: "notifications", label: "Notifications", count: notifications.length, icon: Bell },
  ];

  return (
    <div className="flex h-[280px] max-h-[280px] flex-col overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.02]">
      <div className="border-b border-white/[0.06] px-5 py-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-cyan-500/70">
              Recent Activity
            </p>
            <h3 className="mt-1 text-sm font-medium text-zinc-200">Intelligence Feed</h3>
          </div>
          <Sparkles className="h-4 w-4 text-cyan-500/40" />
        </div>

        <div className="mt-4 flex gap-1 rounded-lg border border-white/[0.06] bg-black/30 p-1">
          {tabs.map((t) => {
            const Icon = t.icon;
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={`relative flex flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-2 text-xs font-medium transition-colors ${
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
                <Icon className="relative h-3.5 w-3.5" />
                <span className="relative hidden sm:inline">{t.label}</span>
                <span className="relative font-mono text-[10px] text-zinc-600">{t.count}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <AnimatePresence mode="wait">
          {tab === "detections" ? (
            <motion.div
              key="detections"
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 12 }}
              transition={{ duration: 0.2 }}
              className="p-4"
            >
              {changes.length === 0 ? (
                <EmptyState
                  icon={Brain}
                  title="No changes detected yet"
                  description="Your monitors are active and watching. Meaningful updates will appear here with an AI summary and importance level."
                />
              ) : (
                <div className="relative space-y-0">
                  <div className="absolute bottom-4 left-[11px] top-4 w-px bg-gradient-to-b from-violet-500/40 via-cyan-500/10 to-transparent" />
                  {changes.map((change, i) => (
                    <motion.div
                      key={change.id}
                      initial={{ opacity: 0, x: 16 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.04, type: "spring", stiffness: 300, damping: 28 }}
                    >
                      <Link
                        href={`/dashboard/changes/${change.id}`}
                        className="group relative flex gap-4 rounded-xl py-3 pr-2 transition-colors hover:bg-white/[0.02]"
                      >
                        <div className="relative z-10 mt-1 flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full border border-violet-400/30 bg-[#090909]">
                          <span className="text-[10px]">{change.emoji}</span>
                        </div>
                        <div className="min-w-0 flex-1 border-b border-white/[0.04] pb-4 last:border-0">
                          <div className="flex items-start justify-between gap-2">
                            <p className="truncate text-sm font-medium text-zinc-200 group-hover:text-cyan-100">
                              {change.monitor.name}
                            </p>
                            <span className="shrink-0 font-mono text-[10px] text-zinc-600">
                              {formatRelativeTime(change.createdAt)}
                            </span>
                          </div>
                          <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-zinc-500 group-hover:text-zinc-400">
                            {change.summary}
                          </p>
                          {(change.importance === "HIGH" || change.importance === "CRITICAL") && (
                            <span className="mt-2 inline-block rounded-full border border-amber-400/20 bg-amber-500/10 px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider text-amber-300/80">
                              {change.importance}
                            </span>
                          )}
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
              className="p-4"
            >
              {notifications.length === 0 ? (
                <EmptyState
                  icon={Bell}
                  title="No notifications yet"
                  description="Email and Telegram alerts will show up here once changes are detected and delivered."
                />
              ) : (
                <div className="space-y-2">
                  {notifications.map((notif, i) => (
                    <motion.div
                      key={notif.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.04 }}
                    >
                      <Link
                        href={`/dashboard/changes/${notif.change.id}`}
                        className="group flex items-start gap-3 rounded-xl border border-white/[0.04] bg-black/20 p-3 transition-colors hover:border-cyan-500/20 hover:bg-cyan-500/[0.04]"
                      >
                        <span className="mt-0.5 text-base">{notif.change.emoji}</span>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-2">
                            <p className="truncate text-sm font-medium text-zinc-200 group-hover:text-cyan-100">
                              {notif.change.monitor.name}
                            </p>
                            <span
                              className={`shrink-0 rounded-full border px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider ${
                                STATUS_STYLES[notif.status] ?? STATUS_STYLES.PENDING
                              }`}
                            >
                              {notif.status}
                            </span>
                          </div>
                          <p className="mt-1 line-clamp-1 text-xs text-zinc-500">
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
