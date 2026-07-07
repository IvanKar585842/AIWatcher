"use client";

import { memo } from "react";
import { motion } from "framer-motion";
import { Activity, AlertTriangle, Brain, HeartPulse, Radio } from "lucide-react";

interface StatItem {
  label: string;
  value: string | number;
  suffix?: string;
  icon: React.ElementType;
  trend?: string;
  accent: string;
}

export const StatReadouts = memo(function StatReadouts({
  activeMonitors,
  changesToday,
  importantAlerts,
  aiAccuracy,
  monitoringHealth,
}: {
  activeMonitors: number;
  changesToday: number;
  importantAlerts: number;
  aiAccuracy: number;
  monitoringHealth: number;
}) {
  const stats: StatItem[] = [
    {
      label: "Active Monitors",
      value: activeMonitors,
      icon: Radio,
      accent: "from-cyan-500/20 to-transparent",
    },
    {
      label: "Changes Today",
      value: changesToday,
      icon: Activity,
      accent: "from-sky-500/20 to-transparent",
    },
    {
      label: "Important Alerts",
      value: importantAlerts,
      icon: AlertTriangle,
      accent: "from-amber-500/20 to-transparent",
    },
    {
      label: "AI Accuracy",
      value: aiAccuracy,
      suffix: "%",
      icon: Brain,
      accent: "from-violet-500/15 to-transparent",
    },
    {
      label: "Monitoring Health",
      value: monitoringHealth,
      suffix: "%",
      icon: HeartPulse,
      accent: "from-emerald-500/20 to-transparent",
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
      {stats.map((stat, i) => (
        <motion.div
          key={stat.label}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.06, type: "spring", stiffness: 320, damping: 28 }}
          className="group relative overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4 transition-colors hover:border-cyan-400/15"
        >
          <div
            className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${stat.accent} opacity-0 transition-opacity group-hover:opacity-100`}
          />
          <div className="relative">
            <div className="flex items-center justify-between">
              <stat.icon className="h-4 w-4 text-zinc-600 group-hover:text-cyan-400/80 transition-colors" />
              <span className="font-mono text-[9px] uppercase tracking-widest text-zinc-700">
                {String(i + 1).padStart(2, "0")}
              </span>
            </div>
            <p className="mt-3 font-mono text-2xl font-medium tabular-nums text-zinc-100">
              {stat.value}
              {stat.suffix && (
                <span className="text-sm text-zinc-500">{stat.suffix}</span>
              )}
            </p>
            <p className="mt-1 text-[11px] text-zinc-600">{stat.label}</p>
          </div>
        </motion.div>
      ))}
    </div>
  );
});
