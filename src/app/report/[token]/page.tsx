"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, Sparkles } from "lucide-react";
import type { WeeklyReportPayload } from "@/lib/reports/types";

export default function PublicReportPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = use(params);
  const [data, setData] = useState<{
    executiveSummary: string;
    payload: WeeklyReportPayload;
    branding: string;
    periodStart: string;
    periodEnd: string;
    user?: { name: string | null; username: string | null };
  } | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetch(`/api/public/report/${token}`)
      .then(async (r) => {
        if (!r.ok) throw new Error("missing");
        return r.json();
      })
      .then((json) => {
        setData({
          executiveSummary: json.report.executiveSummary,
          payload: json.report.payload,
          branding: json.report.branding,
          periodStart: json.report.periodStart,
          periodEnd: json.report.periodEnd,
          user: json.report.user,
        });
      })
      .catch(() => setError(true));
  }, [token]);

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#090909] px-4 text-zinc-400">
        This report is private or no longer available.
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#090909]">
        <Loader2 className="h-6 w-6 animate-spin text-cyan-400" />
      </div>
    );
  }

  const p = data.payload;

  return (
    <div className="min-h-screen bg-[#090909] text-zinc-200">
      <div className="mx-auto max-w-3xl px-4 py-10 sm:py-14">
        <div className="mb-8 flex items-center justify-between">
          <Link href="/" className="text-xs text-zinc-500 hover:text-cyan-300">
            WatchFlowing
          </Link>
          <p className="font-mono text-[10px] uppercase tracking-widest text-zinc-600">
            Shared report
          </p>
        </div>

        <article className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6 sm:p-8">
          <div className="flex items-center gap-2 text-cyan-400">
            <Sparkles className="h-4 w-4" />
            <p className="font-mono text-[10px] uppercase tracking-[0.25em]">
              Intelligence report
            </p>
          </div>
          <h1 className="mt-2 text-2xl font-semibold text-zinc-50">
            {data.user?.name || data.user?.username || "Team"} — Weekly Report
          </h1>
          <p className="mt-1 text-sm text-zinc-500">{p.periodLabel}</p>

          <div className="mt-6 rounded-xl border border-cyan-500/20 bg-cyan-500/[0.06] p-4">
            <p className="text-[15px] leading-relaxed text-zinc-100">
              {data.executiveSummary}
            </p>
            <p className="mt-3 font-mono text-[11px] text-zinc-600">
              {p.stats.totalChanges} changes · {p.stats.importantCount} need attention
            </p>
          </div>

          <section className="mt-8">
            <h2 className="text-sm font-medium text-zinc-200">Important changes</h2>
            <div className="mt-3 space-y-2">
              {p.importantChanges.map((c) => (
                <div
                  key={c.changeId}
                  className="rounded-xl border border-white/[0.06] bg-black/20 p-3"
                >
                  <p className="text-sm font-medium text-zinc-100">{c.monitorName}</p>
                  <p className="mt-1 text-xs text-zinc-400">{c.summary}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="mt-8">
            <h2 className="text-sm font-medium text-zinc-200">Recommendations</h2>
            <ul className="mt-3 space-y-2">
              {p.recommendations.map((r) => (
                <li key={r} className="text-sm text-zinc-400">
                  • {r}
                </li>
              ))}
            </ul>
          </section>

          <footer className="mt-10 border-t border-white/[0.06] pt-5 text-center">
            <p className="text-xs text-zinc-600">{data.branding}</p>
            <Link
              href="/"
              className="mt-2 inline-block text-xs text-cyan-400 hover:text-cyan-300"
            >
              Create your own monitoring with WatchFlowing
            </Link>
          </footer>
        </article>
      </div>
    </div>
  );
}
