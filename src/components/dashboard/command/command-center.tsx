"use client";

import dynamic from "next/dynamic";
import { Suspense, useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { CreateMonitorDialog } from "@/components/dashboard/create-monitor-dialog";
import { CommandCenterSkeleton } from "./dashboard-skeletons";
import { MonitoringHealth } from "./monitoring-health";
import { QuickActions } from "./quick-actions";
import { RecentActivityPanel } from "./recent-activity-panel";
import { StatReadouts } from "./stat-readouts";



const NetworkMap = dynamic(

  () => import("./network-map").then((m) => m.NetworkMap),

  {

    ssr: false,

    loading: () => (

      <div className="min-h-[420px] animate-pulse rounded-2xl border border-white/[0.06] bg-white/[0.02]" />

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

          avgResponseTime: data.stats.avgResponseTime ?? data.stats.analytics?.avgAiResponseMs ?? 0,

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

    <div className="space-y-6 p-4 lg:p-6">

      <motion.div

        initial={{ opacity: 0, y: 12 }}

        animate={{ opacity: 1, y: 0 }}

        className="space-y-4"

      >

        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-cyan-500/60">
              Command Center
            </p>
            <h2 className="mt-1 text-xl font-semibold text-zinc-100">Intelligence Overview</h2>
          </div>
          <CreateMonitorDialog
            variant="os"
            triggerLabel="+ Create Monitor"
            triggerClassName="h-11 px-6 text-sm font-medium shadow-[0_0_36px_-8px_rgba(34,211,238,0.6)]"
            onCreated={() => {
              load();
              window.dispatchEvent(new CustomEvent("monitors-updated"));
            }}
          />
        </div>



        <QuickActions

          onRefresh={load}

          activeCount={stats.activeMonitors}

          pausedCount={stats.pausedMonitors + stats.errorMonitors}

        />

      </motion.div>



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



      <div className="grid gap-4 lg:grid-cols-[1fr_380px]">

        <motion.div

          initial={{ opacity: 0, scale: 0.98 }}

          animate={{ opacity: 1, scale: 1 }}

          transition={{ delay: 0.15 }}

          className="min-h-[420px]"

        >

          <Suspense

            fallback={

              <div className="min-h-[420px] animate-pulse rounded-2xl border border-white/[0.06] bg-white/[0.02]" />

            }

          >

            <NetworkMap monitors={stats.monitors} />

          </Suspense>

        </motion.div>



        <motion.div

          initial={{ opacity: 0, x: 20 }}

          animate={{ opacity: 1, x: 0 }}

          transition={{ delay: 0.2 }}

        >

          <RecentActivityPanel

            changes={stats.recentChanges}

            notifications={stats.recentNotifications}

          />

        </motion.div>

      </div>

    </div>

  );

}


