"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { Suspense, useCallback, useEffect, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { CommandCenterSkeleton } from "./dashboard-skeletons";
import { MonitoringHealth } from "./monitoring-health";
import { QuickActions } from "./quick-actions";
import { StatReadouts } from "./stat-readouts";

const NetworkMap = dynamic(
  () => import("./network-map").then((m) => m.NetworkMap),
  {
    ssr: false,
    loading: () => (
      <div className="min-h-[420px] animate-pulse rounded-2xl border border-white/[0.06] bg-white/[0.02] sm:min-h-[520px] lg:min-h-[640px]" />
    ),
  }
);

const IntelligenceCenter = dynamic(
  () => import("./intelligence-center").then((m) => m.IntelligenceCenter),
  {
    ssr: false,
    loading: () => (
      <div className="min-h-[360px] animate-pulse rounded-2xl border border-white/[0.06] bg-white/[0.02]" />
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
    faviconUrl?: string | null;
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
  const [heavyReady, setHeavyReady] = useState(false);

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

  // Defer map + intelligence until after first paint / idle (longer for LCP/INP)
  useEffect(() => {
    let idleId: number | undefined;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    const enable = () => setHeavyReady(true);

    if (document.readyState === "complete") {
      if ("requestIdleCallback" in window) {
        idleId = window.requestIdleCallback(enable, { timeout: 2500 });
      } else {
        timeoutId = setTimeout(enable, 500);
      }
    } else {
      const onLoad = () => {
        if ("requestIdleCallback" in window) {
          idleId = window.requestIdleCallback(enable, { timeout: 2500 });
        } else {
          timeoutId = setTimeout(enable, 500);
        }
      };
      window.addEventListener("load", onLoad, { once: true });
      timeoutId = setTimeout(enable, 2200);
      return () => {
        window.removeEventListener("load", onLoad);
        if (idleId !== undefined && "cancelIdleCallback" in window) {
          window.cancelIdleCallback(idleId);
        }
        if (timeoutId) clearTimeout(timeoutId);
      };
    }

    return () => {
      if (idleId !== undefined && "cancelIdleCallback" in window) {
        window.cancelIdleCallback(idleId);
      }
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, []);

  // Paint heading immediately — cards fill after stats fetch
  if (loading) {
    return (
      <div className="mx-auto w-full max-w-full space-y-3 overflow-x-hidden p-3 sm:space-y-4 sm:p-4 lg:space-y-6 lg:p-6">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-cyan-500/60">
            Command Center · Live
          </p>
          <h2 className="mt-1.5 text-lg font-semibold tracking-tight text-zinc-50 sm:text-xl">
            WatchFlowing is watching your business
          </h2>
          <p className="mt-1 max-w-xl text-xs leading-relaxed text-zinc-500 sm:text-sm">
            Loading monitors…
          </p>
        </div>
        <CommandCenterSkeleton />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-full space-y-3 overflow-x-hidden p-3 sm:space-y-4 sm:p-4 lg:space-y-6 lg:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
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
      </div>

      {stats.importantAlerts > 0 && (
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
      )}

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

      <div className="grid grid-cols-1 items-stretch gap-3 lg:grid-cols-2 lg:gap-5">
        <div className="order-2 min-w-0 lg:order-1">
          {heavyReady ? (
            <Suspense
              fallback={
                <div className="min-h-[420px] animate-pulse rounded-2xl border border-white/[0.06] bg-white/[0.02] lg:min-h-[640px]" />
              }
            >
              <NetworkMap monitors={stats.monitors} />
            </Suspense>
          ) : (
            <div className="min-h-[420px] animate-pulse rounded-2xl border border-white/[0.06] bg-white/[0.02] lg:min-h-[640px]" />
          )}
        </div>

        <div className="order-1 min-w-0 lg:order-2">
          {heavyReady ? (
            <IntelligenceCenter
              changes={stats.recentChanges}
              notifications={stats.recentNotifications}
            />
          ) : (
            <div className="min-h-[360px] animate-pulse rounded-2xl border border-white/[0.06] bg-white/[0.02]" />
          )}
        </div>
      </div>

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

      <div className="space-y-3 lg:hidden">
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
