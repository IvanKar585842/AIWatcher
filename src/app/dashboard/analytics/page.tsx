"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { BarChart3, Globe, TrendingUp, Zap } from "lucide-react";
import { CommandPageHeader } from "@/components/dashboard/command/command-page-header";
import { EmptyState, StatReadoutsSkeleton } from "@/components/dashboard/command/dashboard-skeletons";

interface AnalyticsData {
  totalMonitors: number;
  changesToday: number;
  importantAlerts: number;
  monitoringHealth: number;
  mostActiveWebsite: {
    name: string;
    url: string;
    changeCount: number;
  } | null;
}

export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/dashboard/stats", { signal: controller.signal })
      .then((r) => {
        if (!r.ok) throw new Error("Failed to load");
        return r.json();
      })
      .then((res) => setData(res.stats))
      .catch((err) => {
        if (err.name !== "AbortError") setError(true);
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, []);

  const metrics = data
    ? [
        {
          label: "Total Coverage",
          value: data.totalMonitors,
          sub: "monitors tracked",
          icon: Globe,
        },
        {
          label: "Daily Velocity",
          value: data.changesToday,
          sub: "changes detected",
          icon: Zap,
        },
        {
          label: "Critical Signals",
          value: data.importantAlerts,
          sub: "high priority today",
          icon: TrendingUp,
        },
        {
          label: "System Health",
          value: `${data.monitoringHealth}%`,
          sub: "uptime quality",
          icon: BarChart3,
        },
      ]
    : [];

  return (
    <div className="p-4 lg:p-6">
      <CommandPageHeader
        label="Intelligence"
        title="Analytics"
        description="Performance metrics across your monitoring network."
      />

      {loading ? (
        <div className="mt-6">
          <StatReadoutsSkeleton />
        </div>
      ) : error ? (
        <div className="mt-6 rounded-2xl border border-white/[0.06] bg-white/[0.02]">
          <EmptyState
            icon={BarChart3}
            title="Unable to load analytics"
            description="We couldn't fetch your metrics. Please refresh the page or try again later."
          />
        </div>
      ) : (
        <>
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            {metrics.map((m, i) => (
              <motion.div
                key={m.label}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.08 }}
                className="relative overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6"
              >
                <div className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-cyan-500/[0.04] blur-2xl" />
                <m.icon className="h-5 w-5 text-cyan-500/60" />
                <p className="mt-4 font-mono text-3xl font-medium tabular-nums text-zinc-100">
                  {m.value}
                </p>
                <p className="mt-1 text-sm font-medium text-zinc-300">{m.label}</p>
                <p className="text-xs text-zinc-600">{m.sub}</p>
              </motion.div>
            ))}
          </div>

          {data?.mostActiveWebsite && (
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.35 }}
              className="mt-6 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6"
            >
              <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-cyan-500/70">
                Top Signal
              </p>
              <h3 className="mt-2 text-lg font-medium text-zinc-100">
                {data.mostActiveWebsite.name}
              </h3>
              <p className="mt-1 text-sm text-zinc-600">{data.mostActiveWebsite.url}</p>
              <p className="mt-4 font-mono text-sm text-cyan-300/80">
                {data.mostActiveWebsite.changeCount} total changes detected
              </p>
            </motion.div>
          )}
        </>
      )}
    </div>
  );
}
