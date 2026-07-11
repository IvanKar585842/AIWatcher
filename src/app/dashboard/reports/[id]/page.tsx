"use client";

import { use, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Check,
  Copy,
  Download,
  Loader2,
  Share2,
  Sparkles,
} from "lucide-react";
import { os } from "@/components/dashboard/os/os-primitives";
import { formatDate } from "@/lib/utils";
import type { WeeklyReportPayload } from "@/lib/reports/types";

type ReportRecord = {
  id: string;
  periodStart: string;
  periodEnd: string;
  reportType: string;
  frequency: string;
  executiveSummary: string;
  payload: WeeklyReportPayload;
  shareEnabled: boolean;
  shareToken: string | null;
  aiUsed: boolean;
};

export default function ReportDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [report, setReport] = useState<ReportRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [sharing, setSharing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [publicUrl, setPublicUrl] = useState<string | null>(null);
  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch(`/api/reports/${id}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.report) {
          setReport(data.report);
          if (data.report.shareEnabled && data.report.shareToken) {
            const origin =
              typeof window !== "undefined" ? window.location.origin : "";
            setPublicUrl(`${origin}/report/${data.report.shareToken}`);
          }
        }
      })
      .finally(() => setLoading(false));
  }, [id]);

  const maxDay = useMemo(() => {
    const days = report?.payload?.stats?.byDay ?? [];
    return Math.max(1, ...days.map((d) => d.count));
  }, [report]);

  async function toggleShare(enabled: boolean) {
    setSharing(true);
    try {
      const res = await fetch(`/api/reports/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shareEnabled: enabled }),
      });
      const data = await res.json();
      if (res.ok && data.report) {
        setReport(data.report);
        setPublicUrl(data.publicUrl);
      }
    } finally {
      setSharing(false);
    }
  }

  async function copyLink() {
    if (!publicUrl) return;
    await navigator.clipboard.writeText(publicUrl);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  }

  function exportPdf() {
    window.print();
  }

  if (loading) {
    return (
      <div className={os.page}>
        <div className="h-40 animate-pulse rounded-2xl bg-white/[0.03]" />
      </div>
    );
  }

  if (!report) {
    return (
      <div className={os.page}>
        <p className="text-sm text-zinc-500">Report not found.</p>
        <Link href="/dashboard/reports" className="mt-3 inline-flex text-cyan-400">
          Back to reports
        </Link>
      </div>
    );
  }

  const p = report.payload;

  return (
    <div className={os.page}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link
          href="/dashboard/reports"
          className="inline-flex items-center gap-1.5 text-xs text-zinc-500 hover:text-cyan-300"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          All reports
        </Link>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={exportPdf}
            className="inline-flex min-h-11 items-center gap-2 rounded-full border border-white/[0.08] px-4 text-xs text-zinc-300 hover:border-cyan-400/25"
          >
            <Download className="h-3.5 w-3.5" />
            Export PDF
          </button>
          <button
            type="button"
            disabled={sharing}
            onClick={() => void toggleShare(!report.shareEnabled)}
            className="inline-flex min-h-11 items-center gap-2 rounded-full border border-cyan-400/25 bg-cyan-500/10 px-4 text-xs text-cyan-100"
          >
            {sharing ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Share2 className="h-3.5 w-3.5" />
            )}
            {report.shareEnabled ? "Disable public link" : "Enable public link"}
          </button>
        </div>
      </div>

      {publicUrl && report.shareEnabled && (
        <div className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-white/[0.06] bg-black/30 p-3 print:hidden">
          <p className="min-w-0 flex-1 truncate font-mono text-[11px] text-zinc-500">
            {publicUrl}
          </p>
          <button
            type="button"
            onClick={() => void copyLink()}
            className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-white/[0.08] px-3 text-xs text-zinc-300"
          >
            {copied ? <Check className="h-3.5 w-3.5 text-emerald-300" /> : <Copy className="h-3.5 w-3.5" />}
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
      )}

      <article
        ref={printRef}
        className="mx-auto max-w-3xl space-y-6 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5 sm:p-8 print:border-0 print:bg-white print:text-black"
      >
        <header>
          <div className="flex items-center gap-2 text-cyan-400 print:text-cyan-700">
            <Sparkles className="h-4 w-4" />
            <p className="font-mono text-[10px] uppercase tracking-[0.25em]">
              WatchFlowing Intelligence
            </p>
          </div>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-zinc-50 print:text-zinc-900">
            Weekly AI Business Report
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            {p.periodLabel} · {report.reportType.toLowerCase()} ·{" "}
            {report.frequency.toLowerCase()}
            {report.aiUsed ? " · AI enriched" : ""}
          </p>
        </header>

        <section className="rounded-xl border border-cyan-500/20 bg-cyan-500/[0.06] p-4 print:border-cyan-200 print:bg-cyan-50">
          <p className="font-mono text-[10px] uppercase tracking-widest text-cyan-500/80">
            Executive summary
          </p>
          <p className="mt-2 text-[15px] leading-relaxed text-zinc-100 print:text-zinc-800">
            {report.executiveSummary}
          </p>
          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[
              ["Changes", p.stats.totalChanges],
              ["Need attention", p.stats.importantCount],
              ["Active sites", p.stats.monitorsActive],
              ["Errors", p.stats.monitorsError],
            ].map(([label, value]) => (
              <div
                key={String(label)}
                className="rounded-lg border border-white/[0.06] bg-black/20 px-3 py-2 print:border-zinc-200 print:bg-white"
              >
                <p className="font-mono text-[9px] uppercase text-zinc-600">{label}</p>
                <p className="mt-1 font-mono text-xl text-zinc-100 print:text-zinc-900">
                  {value}
                </p>
              </div>
            ))}
          </div>
        </section>

        {p.stats.byDay.length > 0 && (
          <section>
            <h2 className="text-sm font-medium text-zinc-200 print:text-zinc-800">
              Activity this period
            </h2>
            <div className="mt-3 flex h-28 items-end gap-1">
              {p.stats.byDay.map((d) => (
                <div key={d.date} className="flex flex-1 flex-col items-center gap-1">
                  <div
                    className="w-full rounded-t bg-cyan-500/70"
                    style={{ height: `${Math.max(8, (d.count / maxDay) * 100)}%` }}
                    title={`${d.date}: ${d.count}`}
                  />
                  <span className="hidden font-mono text-[8px] text-zinc-600 sm:inline">
                    {d.date.slice(5)}
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}

        <section>
          <h2 className="text-sm font-medium text-zinc-200">🚨 Important Changes</h2>
          <div className="mt-3 space-y-2">
            {p.importantChanges.length === 0 ? (
              <p className="text-sm text-zinc-500">No important changes this period.</p>
            ) : (
              p.importantChanges.map((c) => (
                <Link
                  key={c.changeId}
                  href={`/dashboard/changes/${c.changeId}`}
                  className="block rounded-xl border border-white/[0.06] bg-black/20 p-3 hover:border-cyan-500/20 print:pointer-events-none"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-[9px] uppercase text-amber-300">
                      {c.importance}
                    </span>
                    <span className="text-sm font-medium text-zinc-100">
                      {c.emoji ? `${c.emoji} ` : ""}
                      {c.monitorName}
                    </span>
                    <span className="ml-auto font-mono text-[10px] text-zinc-600">
                      {formatDate(c.createdAt)}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-zinc-400">{c.summary}</p>
                </Link>
              ))
            )}
          </div>
        </section>

        <section className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl border border-white/[0.06] p-4">
            <h2 className="text-sm font-medium text-zinc-200">📈 Competitor Intelligence</h2>
            <ul className="mt-3 space-y-2">
              {p.competitorIntelligence.map((line) => (
                <li key={line} className="text-xs leading-relaxed text-zinc-400">
                  • {line}
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-xl border border-white/[0.06] p-4">
            <h2 className="text-sm font-medium text-zinc-200">🔍 SEO Health</h2>
            <ul className="mt-3 space-y-2">
              {p.seoHealth.map((line) => (
                <li key={line} className="text-xs leading-relaxed text-zinc-400">
                  • {line}
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="rounded-xl border border-white/[0.06] p-4">
          <h2 className="text-sm font-medium text-zinc-200">💡 Recommendations</h2>
          <ul className="mt-3 space-y-2">
            {p.recommendations.map((line) => (
              <li key={line} className="text-sm leading-relaxed text-zinc-300">
                • {line}
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-xl border border-white/[0.06] p-4">
          <h2 className="text-sm font-medium text-zinc-200">Unresolved issues</h2>
          <ul className="mt-3 space-y-2">
            {p.unresolvedIssues.map((line) => (
              <li key={line} className="text-xs text-zinc-400">
                • {line}
              </li>
            ))}
          </ul>
        </section>

        <footer className="border-t border-white/[0.06] pt-4 text-center">
          <p className="text-xs text-zinc-600">
            Weekly website intelligence report generated by WatchFlowing
          </p>
        </footer>
      </article>
    </div>
  );
}
