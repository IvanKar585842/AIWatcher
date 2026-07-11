"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { Suspense, useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { AlertTriangle } from "lucide-react";
import { CommandCenterSkeleton } from "./dashboard-skeletons";
import { DetectionAssistantPanel } from "./detection-assistant-panel";
import { MonitoringHealth } from "./monitoring-health";
import { QuickActions } from "./quick-actions";
import { RecentActivityPanel } from "./recent-activity-panel";
import { StatReadouts } from "./stat-readouts";

const NetworkMap = dynamic(
  () => import("./network-map").then((m) => m.NetworkMap),
  {
    ssr: false,
    loading: () => (
      <div className="min-h-[280px] animate-pulse rounded-2xl border border-white/[0.06] bg-white/[0.02] lg:min-h-[360px]" />
    ),
  }
);

interface CommandStats {
  totalMonitors: number;
  activeMonitors: number;
  pausedMonitors: number;
  errorMonitors: number;
  changesToday: number;
  importantAlerts: number;
  aiAccuracy: number;
  monitoringHealth: number;
  avgResponseTime: number;
  recentChanges: Array<{
    id: string;
    summary: string;
    emoji: string;
    importance: string;
    createdAt: string;
    monitor: { name: string; url: string };
  }>;
  recentNotifications: Array<{
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
  }>;
  monitors: Array<{
    id: string;
    name: string;
    url: string;
    status: string;
    lastChangedAt: string | null;
    _count?: { changes: number };
  }>;
}

const EMPTY_STATS: CommandStats = {
  totalMonitors: 0,
  activeMonitors: 0,
  pausedMonitors: 0,
  errorMonitors: 0,
  changesToday: 0,
  importantAlerts: 0,
  aiAccuracy: 100,
  monitoringHealth: 100,
  avgResponseTime: 0,
  recentChanges: [],
  recentNotifications: [],
  monitors: [],
};

export function CommandCenter() {
  const [stats, setStats] = useState<CommandStats>(EMPTY_STATS);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/dashboard/stats");
      const data = await res.json();

      if (res.ok && data.stats) {
        setStats({
          ...EMPTY_STATS,
          ...data.stats,
          avgResponseTime:
            data.stats.avgResponseTime ?? data.stats.analytics?.avgAiResponseMs ?? 0,
        });
      } else {
        setStats(EMPTY_STATS);
      }
    } catch {
      setStats(EMPTY_STATS);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(load, 30000);
    const onMonitorsUpdated = () => load();
    window.addEventListener("monitors-updated", onMonitorsUpdated);
    return () => {
      clearInterval(interval);
      window.removeEventListener("monitors-updated", onMonitorsUpdated);
    };
  }, [load]);

  if (loading) {
    return <CommandCenterSkeleton />;
  }

  return (
    <div className="mx-auto w-full max-w-full space-y-3 overflow-x-hidden p-3 sm:space-y-4 sm:p-4 lg:space-y-6 lg:p-6">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-wrap items-end justify-between gap-3"
      >
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400/50" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
            </span>
            <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-cyan-500/60">
              Command Center · Live
            </p>
          </div>
          <h2 className="mt-1.5 text-lg font-semibold tracking-tight text-zinc-50 sm:text-xl">
            WatchFlowing is watching your business
          </h2>
          <p className="mt-1 max-w-xl text-xs leading-relaxed text-zinc-500 sm:text-sm">
            {stats.activeMonitors} site{stats.activeMonitors === 1 ? "" : "s"} monitored
            {stats.importantAlerts > 0
              ? ` · ${stats.importantAlerts} need attention`
              : " · all clear"}
            {stats.changesToday > 0
              ? ` · ${stats.changesToday} change${stats.changesToday === 1 ? "" : "s"} today`
              : ""}
            . AI explains what matters — not just what changed.
          </p>
        </div>
        <div className="hidden lg:block">
          <QuickActions
            onRefresh={load}
            activeCount={stats.activeMonitors}
            pausedCount={stats.pausedMonitors + stats.errorMonitors}
          />
        </div>
      </motion.div>

      {/* 1. Important alerts — mobile priority */}
      {stats.importantAlerts > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Link
            href="/dashboard/notifications"
            className="flex min-h-12 items-center gap-3 rounded-xl border border-amber-400/25 bg-amber-500/[0.08] px-3 py-3 transition-colors hover:border-amber-400/40 sm:px-4"
          >
            <AlertTriangle className="h-5 w-5 shrink-0 text-amber-300" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-amber-100">
                {stats.importantAlerts} important alert
                {stats.importantAlerts === 1 ? "" : "s"}
              </p>
              <p className="truncate text-xs text-amber-200/60">
                Review high-priority detections
              </p>
            </div>
            <span className="shrink-0 text-xs text-amber-300/80">View</span>
          </Link>
        </motion.div>
      )}

      {/* Desktop stats above main grid */}
      <div className="hidden space-y-4 lg:block">
        <StatReadouts
          activeMonitors={stats.activeMonitors}
          changesToday={stats.changesToday}
          importantAlerts={stats.importantAlerts}
          aiAccuracy={stats.aiAccuracy}
          monitoringHealth={stats.monitoringHealth}
        />
        <MonitoringHealth
          onlineMonitors={stats.activeMonitors}
          pausedMonitors={stats.pausedMonitors}
          failedMonitors={stats.errorMonitors}
          avgResponseTime={stats.avgResponseTime}
          totalMonitors={stats.totalMonitors}
        />
      </div>

      {/*
        Mobile order: Assistant → status → feed → map → secondary
        Desktop: map | sticky assistant+feed
      */}
      <div className="grid grid-cols-1 items-start gap-3 lg:grid-cols-[minmax(0,1fr)_380px] lg:gap-4">
        {/* 2. AI Assistant + 4. Recent changes */}
        <motion.div
          initial={{ opacity: 0, x: 12 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.08 }}
          className="order-1 flex w-full min-w-0 flex-col gap-3 lg:order-2 lg:sticky lg:top-20"
        >
          <DetectionAssistantPanel />

          {/* 3. Monitor status — compact on mobile between assistant & feed */}
          <div className="lg:hidden">
            <StatReadouts
              activeMonitors={stats.activeMonitors}
              changesToday={stats.changesToday}
              importantAlerts={stats.importantAlerts}
              aiAccuracy={stats.aiAccuracy}
              monitoringHealth={stats.monitoringHealth}
              mobilePriority
            />
          </div>

          <RecentActivityPanel
            changes={stats.recentChanges}
            notifications={stats.recentNotifications}
          />
        </motion.div>

        {/* Network map — collapsed on mobile, primary on desktop */}
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.12 }}
          className="order-3 min-w-0 lg:order-1"
        >
          <div className="lg:hidden">
            <details className="group rounded-2xl border border-white/[0.06] bg-white/[0.02] open:border-cyan-500/15">
              <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-2 px-4 py-3 text-sm text-zinc-300 [&::-webkit-details-marker]:hidden">
                <span className="font-medium">Monitor network map</span>
                <span className="font-mono text-[10px] text-zinc-600 group-open:hidden">
                  Show
                </span>
                <span className="hidden font-mono text-[10px] text-zinc-600 group-open:inline">
                  Hide
                </span>
              </summary>
              <div className="min-h-[220px] p-2 pt-0">
                <Suspense
                  fallback={
                    <div className="min-h-[220px] animate-pulse rounded-xl border border-white/[0.06] bg-white/[0.02]" />
                  }
                >
                  <NetworkMap monitors={stats.monitors} />
                </Suspense>
              </div>
            </details>
          </div>
          <div className="hidden min-h-[360px] lg:block">
            <Suspense
              fallback={
                <div className="min-h-[360px] animate-pulse rounded-2xl border border-white/[0.06] bg-white/[0.02]" />
              }
            >
              <NetworkMap monitors={stats.monitors} />
            </Suspense>
          </div>
        </motion.div>
      </div>

      {/* Secondary mobile: health + quick actions */}
      <div className="order-4 space-y-3 lg:hidden">
        <MonitoringHealth
          onlineMonitors={stats.activeMonitors}
          pausedMonitors={stats.pausedMonitors}
          failedMonitors={stats.errorMonitors}
          avgResponseTime={stats.avgResponseTime}
          totalMonitors={stats.totalMonitors}
        />
        <QuickActions
          onRefresh={load}
          activeCount={stats.activeMonitors}
          pausedCount={stats.pausedMonitors + stats.errorMonitors}
        />
      </div>
    </div>
  );
}
