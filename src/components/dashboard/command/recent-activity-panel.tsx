"use client";

import { memo, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { Bell, Brain, Sparkles } from "lucide-react";
import { useFeedNotifications } from "@/hooks/use-dashboard-bootstrap";
import { cn, formatRelativeTime } from "@/lib/utils";
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
  notifications: notificationsProp,
  embedded = false,
}: {
  changes: ActivityChange[];
  notifications: ActivityNotification[];
  embedded?: boolean;
}) {
  const [tab, setTab] = useState<Tab>("detections");
  const needNotifications = tab === "notifications";
  const { data: notifData, isLoading: notifLoading } = useFeedNotifications(needNotifications);
  const notifications =
    notifData?.notifications ?? notificationsProp ?? [];

  const tabs: { id: Tab; label: string; short: string; count: number; icon: React.ElementType }[] = [
    { id: "detections", label: "AI Detections", short: "Detections", count: changes.length, icon: Brain },
    {
      id: "notifications",
      label: "Notifications",
      short: "Alerts",
      count: notifications.length || notificationsProp.length,
      icon: Bell,
    },
  ];

  return (
    <div
      className={cn(
        "flex w-full min-w-0 flex-col",
        embedded
          ? "h-full min-h-0 overflow-hidden"
          : "max-h-[min(560px,70vh)] overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.02]"
      )}
    >
      <div
        className={cn(
          "shrink-0 px-3 py-3 sm:px-5 sm:py-4",
          embedded ? "border-b border-white/[0.04]" : "border-b border-white/[0.06]"
        )}
      >
        {!embedded && (
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
        )}

        <div
          className={cn(
            "grid grid-cols-2 gap-1 rounded-xl border border-white/[0.06] bg-black/30 p-1",
            embedded ? "mt-0" : "mt-3 sm:mt-4"
          )}
        >
          {tabs.map((t) => {
            const Icon = t.icon;
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={`relative flex min-h-11 items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-xs font-medium transition-colors ${
                  active ? "text-cyan-100" : "text-zinc-500 hover:text-zinc-300"
                }`}
              >
                {active && (
                  <motion.div
                    layoutId={embedded ? "feed-inner-tab" : "activity-tab"}
                    className="absolute inset-0 rounded-lg border border-cyan-500/20 bg-cyan-500/10"
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

      <div className="min-h-0 w-full min-w-0 flex-1 overflow-y-auto overscroll-contain scroll-smooth scrollbar-none">
        <AnimatePresence mode="wait">
          {tab === "detections" ? (
            <motion.div
              key="detections"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.18 }}
              className="p-3 sm:p-5"
            >
              {changes.length === 0 ? (
                <EmptyState
                  icon={Brain}
                  title="No intelligence insights yet"
                  description="Once WatchFlowing detects important changes, AI insights will appear here."
                />
              ) : (
                <div className="space-y-2">
                  {changes.map((change, i) => (
                    <motion.div
                      key={change.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: Math.min(i * 0.03, 0.24) }}
                    >
                      <Link
                        href={`/dashboard/changes/${change.id}`}
                        className="group block min-h-[4.5rem] rounded-xl border border-white/[0.05] bg-black/20 p-3 transition-colors hover:border-cyan-500/20 hover:bg-cyan-500/[0.04] active:bg-white/[0.04]"
                      >
                        <div className="flex items-start gap-3">
                          <span className="mt-0.5 text-base leading-none">{change.emoji}</span>
                          <div className="min-w-0 flex-1 overflow-hidden">
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
                            <p className="mt-1.5 break-words text-sm font-medium text-zinc-100 group-hover:text-cyan-100">
                              {change.monitor.name}
                            </p>
                            <p className="truncate font-mono text-[10px] text-zinc-600">
                              {hostFromUrl(change.monitor.url)}
                            </p>
                            <p className="mt-1.5 break-words text-xs leading-relaxed text-zinc-400 [overflow-wrap:anywhere]">
                              {change.summary}
                            </p>
                            <p className="mt-2 text-[10px] font-medium text-cyan-500/70">
                              Recommended: review this change →
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
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.18 }}
              className="p-3 sm:p-5"
            >
              {notifLoading && notifications.length === 0 ? (
                <p className="py-8 text-center text-xs text-zinc-600">Loading alerts…</p>
              ) : notifications.length === 0 ? (
                <EmptyState
                  icon={Bell}
                  title="No notifications yet"
                  description="Email, Telegram, and in-app alerts for monitored changes will appear here."
                />
              ) : (
                <div className="space-y-2">
                  {notifications.map((notif, i) => (
                    <motion.div
                      key={notif.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: Math.min(i * 0.03, 0.24) }}
                    >
                      <Link
                        href={`/dashboard/changes/${notif.change.id}`}
                        className="group flex min-h-[4.5rem] items-start gap-3 rounded-xl border border-white/[0.05] bg-black/20 p-3 transition-colors hover:border-cyan-500/20 hover:bg-cyan-500/[0.04]"
                      >
                        <span className="mt-0.5 text-base">{notif.change.emoji}</span>
                        <div className="min-w-0 flex-1 overflow-hidden">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="min-w-0 break-words text-sm font-medium text-zinc-200 group-hover:text-cyan-100">
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
                          <p className="mt-1 break-words text-xs text-zinc-400 [overflow-wrap:anywhere]">
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
