"use client";

import { memo } from "react";
import { Activity, AlertCircle, Clock, Pause } from "lucide-react";

interface MonitoringHealthProps {
  onlineMonitors: number;
  pausedMonitors: number;
  failedMonitors: number;
  avgResponseTime: number;
  totalMonitors: number;
}

const DELAYS = [
  "wf-enter",
  "wf-enter-delay-1",
  "wf-enter-delay-2",
  "wf-enter-delay-3",
] as const;

function HealthCard({
  label,
  value,
  suffix,
  icon: Icon,
  accent,
  enterClass,
  barPercent,
  barColor,
}: {
  label: string;
  value: string | number;
  suffix?: string;
  icon: React.ElementType;
  accent: string;
  enterClass: string;
  barPercent: number;
  barColor: string;
}) {
  return (
    <div
      className={`wf-card-hover group relative min-w-0 overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.02] p-3 hover:border-white/[0.1] sm:p-4 ${enterClass}`}
    >
      <div className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${accent} opacity-40`} />
      <div className="relative">
        <div className="flex items-center justify-between">
          <Icon className="h-4 w-4 text-zinc-500 transition-colors duration-200 group-hover:text-cyan-400/80" />
          <span className="font-mono text-[9px] uppercase tracking-widest text-zinc-700">
            Health
          </span>
        </div>
        <p className="mt-3 font-mono text-2xl font-medium tabular-nums text-zinc-100">
          {value}
          {suffix && <span className="ml-0.5 text-sm text-zinc-500">{suffix}</span>}
        </p>
        <p className="mt-1 text-[11px] text-zinc-600">{label}</p>
        <div className="mt-3 h-1 overflow-hidden rounded-full bg-white/[0.06]">
          <div
            className={`h-full rounded-full bg-gradient-to-r ${barColor} transition-[width] duration-700 ease-out`}
            style={{ width: `${Math.max(0, Math.min(100, barPercent))}%` }}
          />
        </div>
      </div>
    </div>
  );
}

export const MonitoringHealth = memo(function MonitoringHealth({
  onlineMonitors,
  pausedMonitors,
  failedMonitors,
  avgResponseTime,
  totalMonitors,
}: MonitoringHealthProps) {
  const total = Math.max(totalMonitors, 1);

  const cards = [
    {
      label: "Online Monitors",
      value: onlineMonitors,
      icon: Activity,
      accent: "from-emerald-500/20 to-transparent",
      barColor: "from-emerald-500/80 to-emerald-400/40",
      barPercent: (onlineMonitors / total) * 100,
    },
    {
      label: "Paused Monitors",
      value: pausedMonitors,
      icon: Pause,
      accent: "from-amber-500/20 to-transparent",
      barColor: "from-amber-500/80 to-amber-400/40",
      barPercent: (pausedMonitors / total) * 100,
    },
    {
      label: "Failed Monitors",
      value: failedMonitors,
      icon: AlertCircle,
      accent: "from-red-500/20 to-transparent",
      barColor: "from-red-500/80 to-red-400/40",
      barPercent: (failedMonitors / total) * 100,
    },
    {
      label: "Avg Response Time",
      value: avgResponseTime > 0 ? avgResponseTime : "—",
      suffix: avgResponseTime > 0 ? "ms" : undefined,
      icon: Clock,
      accent: "from-cyan-500/20 to-transparent",
      barColor: "from-cyan-500/80 to-cyan-400/40",
      barPercent: avgResponseTime > 0 ? Math.min(100, (avgResponseTime / 5000) * 100) : 0,
    },
  ];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between px-1">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-cyan-500/70">
            System Status
          </p>
          <h3 className="mt-0.5 text-sm font-medium text-zinc-200">Monitoring Health</h3>
        </div>
        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-40" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
          </span>
          <span className="font-mono text-[10px] text-zinc-600">Live</span>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
        {cards.map((card, i) => (
          <HealthCard
            key={card.label}
            {...card}
            enterClass={DELAYS[i] ?? "wf-enter"}
          />
        ))}
      </div>
    </div>
  );
});
