"use client";

import { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import { Plus } from "lucide-react";
import Link from "next/link";
import { ActivityFeed } from "./activity-feed";
import { NetworkMap, type NetworkMonitor } from "./network-map";
import { StatReadouts } from "./stat-readouts";

interface CommandStats {
  totalMonitors: number;
  activeMonitors: number;
  changesToday: number;
  importantAlerts: number;
  aiAccuracy: number;
  monitoringHealth: number;
  recentChanges: Array<{
    id: string;
    summary: string;
    emoji: string;
    importance: string;
    createdAt: string;
    monitor: { name: string; url: string };
  }>;
  monitors: NetworkMonitor[];
}

export function CommandCenter() {
  const [stats, setStats] = useState<CommandStats | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const res = await fetch("/api/dashboard/stats");
    const data = await res.json();
    setStats(data.stats ?? null);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(load, 30000);
    return () => clearInterval(interval);
  }, [load]);

  if (loading) {
    return (
      <div className="space-y-6 p-4 lg:p-6">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-28 animate-pulse rounded-2xl bg-white/[0.03]" />
          ))}
        </div>
        <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
          <div className="h-[420px] animate-pulse rounded-2xl bg-white/[0.03]" />
          <div className="h-[420px] animate-pulse rounded-2xl bg-white/[0.03]" />
        </div>
      </div>
    );
  }

  if (!stats) return null;

  return (
    <div className="space-y-6 p-4 lg:p-6">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-wrap items-end justify-between gap-4"
      >
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-cyan-500/60">
            Command Center
          </p>
          <h2 className="mt-1 text-xl font-semibold text-zinc-100">
            Intelligence Overview
          </h2>
        </div>
        <Link
          href="/dashboard/monitors"
          className="inline-flex items-center gap-2 rounded-full border border-cyan-400/25 bg-cyan-500/10 px-4 py-2 text-xs font-medium text-cyan-100 transition-colors hover:border-cyan-300/40 hover:bg-cyan-500/15"
        >
          <Plus className="h-3.5 w-3.5" />
          New Monitor
        </Link>
      </motion.div>

      <StatReadouts
        activeMonitors={stats.activeMonitors}
        changesToday={stats.changesToday}
        importantAlerts={stats.importantAlerts}
        aiAccuracy={stats.aiAccuracy}
        monitoringHealth={stats.monitoringHealth}
      />

      <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.15 }}
          className="min-h-[420px]"
        >
          <NetworkMap monitors={stats.monitors} />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2 }}
          className="min-h-[420px] overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.02]"
        >
          <ActivityFeed events={stats.recentChanges} />
        </motion.div>
      </div>
    </div>
  );
}
