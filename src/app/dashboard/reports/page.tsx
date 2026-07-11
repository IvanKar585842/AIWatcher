"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  FileText,
  Loader2,
  RefreshCw,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import { CommandPageHeader } from "@/components/dashboard/command/command-page-header";
import { os } from "@/components/dashboard/os/os-primitives";
import { formatDate } from "@/lib/utils";

type ReportListItem = {
  id: string;
  periodStart: string;
  periodEnd: string;
  reportType: string;
  frequency: string;
  executiveSummary: string;
  totalChanges: number;
  importantCount: number;
  aiUsed: boolean;
  createdAt: string;
};

export default function ReportsPage() {
  const [reports, setReports] = useState<ReportListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [prefs, setPrefs] = useState<{
    weeklyReportEnabled: boolean;
    reportFrequency: string;
    reportType: string;
  } | null>(null);

  async function load() {
    const res = await fetch("/api/reports");
    if (!res.ok) return;
    const data = await res.json();
    setReports(data.reports ?? []);
    setPrefs(data.preferences ?? null);
  }

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, []);

  async function generateNow() {
    setGenerating(true);
    try {
      await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ force: true, deliver: false }),
      });
      await load();
    } finally {
      setGenerating(false);
    }
  }

  const latest = useMemo(() => reports[0], [reports]);

  return (
    <div className={os.page}>
      <CommandPageHeader
        label="Intelligence"
        title="Weekly AI Reports"
        description="WatchFlowing works for you even when you are not looking — executive summaries of what changed and what needs attention."
      >
          <button
            type="button"
            onClick={() => void generateNow()}
            disabled={generating}
            className="inline-flex min-h-11 items-center gap-2 rounded-full border border-cyan-400/30 bg-cyan-500/15 px-4 text-sm font-medium text-cyan-100 transition-colors hover:bg-cyan-500/25 disabled:opacity-50"
          >
            {generating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            Generate now
          </button>
      </CommandPageHeader>

      {prefs && (
        <p className="mb-4 text-xs text-zinc-500">
          Delivery: {prefs.weeklyReportEnabled ? "on" : "off"} ·{" "}
          {prefs.reportFrequency.toLowerCase()} · {prefs.reportType.toLowerCase()}{" "}
          focus ·{" "}
          <Link href="/dashboard/settings" className="text-cyan-400 hover:text-cyan-300">
            Manage preferences
          </Link>
        </p>
      )}

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-28 animate-pulse rounded-2xl bg-white/[0.03]" />
          ))}
        </div>
      ) : reports.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-cyan-500/20 bg-cyan-500/[0.03] px-6 py-16 text-center">
          <Sparkles className="mx-auto h-8 w-8 text-cyan-400/70" />
          <h3 className="mt-4 text-lg font-semibold text-zinc-100">
            Your first intelligence report is ready to generate
          </h3>
          <p className="mx-auto mt-2 max-w-md text-sm text-zinc-500">
            Every week WatchFlowing will summarize detections, health, SEO signals, and
            recommendations — so you always know what mattered.
          </p>
          <button
            type="button"
            onClick={() => void generateNow()}
            disabled={generating}
            className="mt-6 inline-flex min-h-11 items-center gap-2 rounded-full border border-cyan-400/30 bg-cyan-500/15 px-5 text-sm text-cyan-100"
          >
            {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
            Create this week&apos;s report
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {latest && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-2xl border border-cyan-500/20 bg-gradient-to-br from-cyan-500/[0.07] to-transparent p-5"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-cyan-500/70">
                    Latest report
                  </p>
                  <h2 className="mt-1 text-lg font-semibold text-zinc-50">
                    {formatDate(latest.periodStart)} – {formatDate(latest.periodEnd)}
                  </h2>
                </div>
                <div className="flex items-center gap-2 text-xs text-zinc-500">
                  <TrendingUp className="h-3.5 w-3.5 text-cyan-400" />
                  {latest.totalChanges} changes · {latest.importantCount} attention
                </div>
              </div>
              <p className="mt-3 text-sm leading-relaxed text-zinc-300">
                {latest.executiveSummary}
              </p>
              <Link
                href={`/dashboard/reports/${latest.id}`}
                className="mt-4 inline-flex min-h-11 items-center rounded-full border border-white/[0.08] bg-black/30 px-4 text-sm text-cyan-200 hover:border-cyan-400/30"
              >
                Open full report
              </Link>
            </motion.div>
          )}

          {reports.map((report, i) => (
            <motion.div
              key={report.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(i * 0.04, 0.3) }}
            >
              <Link
                href={`/dashboard/reports/${report.id}`}
                className="block rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4 transition-colors hover:border-cyan-500/20 hover:bg-cyan-500/[0.03]"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-medium text-zinc-100">
                    {formatDate(report.periodStart)} – {formatDate(report.periodEnd)}
                  </p>
                  <span className="font-mono text-[10px] uppercase tracking-wider text-zinc-600">
                    {report.reportType}
                  </span>
                </div>
                <p className="mt-2 line-clamp-2 text-xs text-zinc-500">
                  {report.executiveSummary}
                </p>
                <p className="mt-2 font-mono text-[10px] text-zinc-600">
                  {report.totalChanges} changes · {report.importantCount} important
                  {report.aiUsed ? " · AI enriched" : " · heuristic"}
                </p>
              </Link>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
