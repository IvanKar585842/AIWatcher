"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle } from "lucide-react";
import {
  getReadImportantChangeIds,
  markImportantChangesRead,
  markNotificationsRead,
  READ_STATE_EVENT,
} from "@/lib/notification-read-state";
import { CommandCenterSkeleton } from "./dashboard-skeletons";
import { MonitoringHealth } from "./monitoring-health";
import { QuickActions } from "./quick-actions";
import { StatReadouts } from "./stat-readouts";
import { PopularMonitoringExamples } from "@/components/dashboard/popular-monitoring-examples";

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

interface ImportantAlertChange {
  id: string;
  summary: string;
  emoji: string;
  importance: string;
  createdAt: string;
  monitor: { name: string };
}

interface CommandStats {
  totalMonitors: number;
  activeMonitors: number;
  pausedMonitors: number;
  errorMonitors: number;
  changesToday: number;
  importantAlerts: number;
  importantAlertChanges: ImportantAlertChange[];
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
  importantAlertChanges: [],
  aiAccuracy: 100,
  monitoringHealth: 100,
  avgResponseTime: 0,
  recentChanges: [],
  recentNotifications: [],
  monitors: [],
};

export function CommandCenter() {
  const router = useRouter();
  const [stats, setStats] = useState<CommandStats>(EMPTY_STATS);
  const [loading, setLoading] = useState(true);
  const [heavyReady, setHeavyReady] = useState(false);
  const [readImportantIds, setReadImportantIds] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/dashboard/stats");
      const data = await res.json();

      if (res.ok && data.stats) {
        setStats({
          ...EMPTY_STATS,
          ...data.stats,
          importantAlertChanges: data.stats.importantAlertChanges ?? [],
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
    setReadImportantIds(getReadImportantChangeIds());
    function syncRead() {
      setReadImportantIds(getReadImportantChangeIds());
    }
    window.addEventListener(READ_STATE_EVENT, syncRead);
    window.addEventListener("storage", syncRead);
    return () => {
      window.removeEventListener(READ_STATE_EVENT, syncRead);
      window.removeEventListener("storage", syncRead);
    };
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

  const unreadImportant = useMemo(() => {
    const list = stats.importantAlertChanges ?? [];
    return list.filter((c) => !readImportantIds.has(c.id));
  }, [stats.importantAlertChanges, readImportantIds]);

  const unreadImportantCount = unreadImportant.length;

  function handleViewImportantAlerts(e?: React.MouseEvent) {
    e?.preventDefault();
    const changeIds = unreadImportant.map((c) => c.id);
    if (changeIds.length > 0) {
      markImportantChangesRead(changeIds);
      const relatedNotificationIds = stats.recentNotifications
        .filter((n) => changeIds.includes(n.change.id))
        .map((n) => n.id);
      if (relatedNotificationIds.length > 0) {
        markNotificationsRead(relatedNotificationIds);
      }
      setReadImportantIds(getReadImportantChangeIds());
    }
    const first = unreadImportant[0];
    if (first) {
      router.push(`/dashboard/changes/${first.id}`);
    } else {
      router.push("/dashboard/notifications");
    }
  }
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
            {unreadImportantCount > 0
              ? ` · ${unreadImportantCount} need attention`
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

      {unreadImportantCount > 0 && (
        <button
          type="button"
          onClick={handleViewImportantAlerts}
          className="flex min-h-12 w-full items-center gap-3 rounded-xl border border-amber-400/25 bg-amber-500/[0.08] px-3 py-3 text-left transition-colors hover:border-amber-400/40 sm:px-4"
        >
          <AlertTriangle className="h-5 w-5 shrink-0 text-amber-300" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-amber-100">
              {unreadImportantCount} important alert
              {unreadImportantCount === 1 ? "" : "s"}
            </p>
            <p className="truncate text-xs text-amber-200/60">
              {unreadImportant[0]
                ? `${unreadImportant[0].emoji} ${unreadImportant[0].monitor.name}: ${unreadImportant[0].summary}`
                : "Review high-priority detections"}
            </p>
          </div>
          <span className="shrink-0 text-xs text-amber-300/80">View</span>
        </button>
      )}

      <div className="hidden space-y-4 lg:block">
        <StatReadouts
          activeMonitors={stats.activeMonitors}
          changesToday={stats.changesToday}
          importantAlerts={unreadImportantCount}
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

      <PopularMonitoringExamples />

      <div className="lg:hidden">
        <StatReadouts
          activeMonitors={stats.activeMonitors}
          changesToday={stats.changesToday}
          importantAlerts={unreadImportantCount}
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
