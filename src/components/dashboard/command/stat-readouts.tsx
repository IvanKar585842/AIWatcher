"use client";

import { memo } from "react";
import { Activity, AlertTriangle, Brain, HeartPulse, Radio } from "lucide-react";

interface StatItem {
  label: string;
  value: string | number;
  suffix?: string;
  icon: React.ElementType;
  accent: string;
}

const DELAYS = [
  "wf-enter",
  "wf-enter-delay-1",
  "wf-enter-delay-2",
  "wf-enter-delay-3",
  "wf-enter-delay-4",
] as const;

export const StatReadouts = memo(function StatReadouts({
  activeMonitors,
  changesToday,
  importantAlerts,
  aiAccuracy,
  monitoringHealth,
  mobilePriority = false,
}: {
  activeMonitors: number;
  changesToday: number;
  importantAlerts: number;
  aiAccuracy: number;
  monitoringHealth: number;
  /** On mobile dashboards, show only the three highest-value metrics */
  mobilePriority?: boolean;
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
    <div
      className={
        mobilePriority
          ? "grid grid-cols-3 gap-2"
          : "grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3 lg:grid-cols-5"
      }
    >
      {stats.map((stat, i) => {
        const secondary = i >= 3;
        if (mobilePriority && secondary) return null;

        return (
          <div
            key={stat.label}
            className={`wf-card-hover group relative min-w-0 overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.02] p-3 hover:border-cyan-400/15 sm:p-4 ${
              DELAYS[i] ?? "wf-enter"
            } ${secondary ? "hidden sm:block" : ""}`}
          >
            <div
              className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${stat.accent} opacity-0 transition-opacity duration-200 group-hover:opacity-100`}
            />
            <div className="relative">
              <div className="flex items-center justify-between gap-1">
                <stat.icon className="h-4 w-4 shrink-0 text-zinc-600 transition-colors duration-200 group-hover:text-cyan-400/80" />
                <span className="hidden font-mono text-[9px] uppercase tracking-widest text-zinc-700 sm:inline">
                  {String(i + 1).padStart(2, "0")}
                </span>
              </div>
              <p className="mt-2 font-mono text-xl font-medium tabular-nums text-zinc-100 sm:mt-3 sm:text-2xl">
                {stat.value}
                {stat.suffix && (
                  <span className="text-sm text-zinc-500">{stat.suffix}</span>
                )}
              </p>
              <p className="mt-1 text-[10px] leading-tight text-zinc-600 sm:text-[11px]">
                {stat.label}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
});
