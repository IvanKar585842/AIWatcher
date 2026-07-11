import Link from "next/link";
import { Activity, ArrowLeft, CheckCircle2, AlertTriangle, PauseCircle, XCircle } from "lucide-react";
import type { PublicMonitorStatus } from "@/lib/status-page";
import { formatDate, formatRelativeTime } from "@/lib/utils";
import { cn } from "@/lib/utils";

type MonitorRow = {
  id: string;
  name: string;
  domain: string;
  status: PublicMonitorStatus;
  statusLabel: string;
  uptimePercent: number;
  lastSuccessfulCheck: string | null;
  lastCheckedAt: string | null;
};

type IncidentRow = {
  id: string;
  monitorName: string;
  summary: string;
  emoji: string;
  importance: string;
  createdAt: string;
};

export type StatusPageData = {
  username: string;
  title: string;
  overall: PublicMonitorStatus;
  overallLabel: string;
  monitors: MonitorRow[];
  incidents: IncidentRow[];
};

const STATUS_STYLES: Record<
  PublicMonitorStatus,
  { bar: string; text: string; icon: typeof CheckCircle2 }
> = {
  operational: {
    bar: "bg-emerald-500",
    text: "text-emerald-300",
    icon: CheckCircle2,
  },
  degraded: {
    bar: "bg-amber-500",
    text: "text-amber-300",
    icon: AlertTriangle,
  },
  down: {
    bar: "bg-red-500",
    text: "text-red-300",
    icon: XCircle,
  },
  paused: {
    bar: "bg-zinc-500",
    text: "text-zinc-400",
    icon: PauseCircle,
  },
};

export function StatusPageView({ data }: { data: StatusPageData }) {
  const overall = STATUS_STYLES[data.overall];
  const OverallIcon = overall.icon;

  return (
    <div className="min-h-screen bg-[#090909] text-zinc-100">
      <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
        <div className="mb-8 flex items-center justify-between gap-4">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-xs text-zinc-500 transition-colors hover:text-cyan-300"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            AI Watcher
          </Link>
          <p className="font-mono text-[10px] uppercase tracking-widest text-zinc-600">
            Public status
          </p>
        </div>

        <header className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6 sm:p-8">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-cyan-400/20 bg-cyan-500/10">
              <Activity className="h-5 w-5 text-cyan-300" />
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="text-2xl font-semibold tracking-tight text-zinc-50 sm:text-3xl">
                {data.title}
              </h1>
              <p className="mt-1 text-sm text-zinc-500">@{data.username}</p>
              <div className={cn("mt-4 inline-flex items-center gap-2 text-sm font-medium", overall.text)}>
                <OverallIcon className="h-4 w-4" />
                {data.overallLabel}
              </div>
            </div>
          </div>
        </header>

        <section className="mt-8">
          <h2 className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">
            Websites
          </h2>
          <div className="mt-3 space-y-3">
            {data.monitors.length === 0 && (
              <p className="rounded-xl border border-dashed border-white/[0.08] px-4 py-10 text-center text-sm text-zinc-500">
                No public monitors yet.
              </p>
            )}
            {data.monitors.map((m) => {
              const style = STATUS_STYLES[m.status];
              const Icon = style.icon;
              return (
                <article
                  key={m.id}
                  className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 sm:p-5"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={cn("h-2 w-2 rounded-full", style.bar)} />
                        <h3 className="truncate text-sm font-medium text-zinc-100">{m.name}</h3>
                      </div>
                      <p className="mt-1 truncate text-xs text-zinc-500">{m.domain}</p>
                    </div>
                    <div className={cn("inline-flex items-center gap-1.5 text-xs font-medium", style.text)}>
                      <Icon className="h-3.5 w-3.5" />
                      {m.statusLabel}
                    </div>
                  </div>

                  <div className="mt-4 grid gap-3 sm:grid-cols-3">
                    <div className="rounded-lg border border-white/[0.04] bg-black/30 px-3 py-2">
                      <p className="font-mono text-[9px] uppercase tracking-wider text-zinc-600">
                        Uptime
                      </p>
                      <p className="mt-1 text-lg font-semibold text-zinc-100">
                        {m.uptimePercent}%
                      </p>
                    </div>
                    <div className="rounded-lg border border-white/[0.04] bg-black/30 px-3 py-2 sm:col-span-2">
                      <p className="font-mono text-[9px] uppercase tracking-wider text-zinc-600">
                        Last successful check
                      </p>
                      <p className="mt-1 text-sm text-zinc-200">
                        {m.lastSuccessfulCheck
                          ? formatRelativeTime(m.lastSuccessfulCheck)
                          : "—"}
                      </p>
                      {m.lastSuccessfulCheck && (
                        <p className="mt-0.5 font-mono text-[10px] text-zinc-600">
                          {formatDate(m.lastSuccessfulCheck)}
                        </p>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        <section className="mt-10">
          <h2 className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">
            Recent incidents
          </h2>
          <div className="mt-3 space-y-2">
            {data.incidents.length === 0 && (
              <p className="rounded-xl border border-dashed border-white/[0.08] px-4 py-8 text-center text-sm text-zinc-500">
                No recent high-importance incidents.
              </p>
            )}
            {data.incidents.map((inc) => (
              <div
                key={inc.id}
                className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm text-zinc-200">
                      <span className="mr-1.5">{inc.emoji}</span>
                      {inc.summary}
                    </p>
                    <p className="mt-1 text-xs text-zinc-500">{inc.monitorName}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="font-mono text-[9px] uppercase tracking-wider text-amber-400/80">
                      {inc.importance}
                    </p>
                    <p className="mt-1 text-[10px] text-zinc-600">
                      {formatRelativeTime(inc.createdAt)}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        <footer className="mt-12 border-t border-white/[0.06] pt-6 text-center">
          <p className="text-xs text-zinc-600">
            Powered by{" "}
            <Link href="/" className="text-cyan-400/80 hover:text-cyan-300">
              AI Watcher
            </Link>
          </p>
        </footer>
      </div>
    </div>
  );
}
