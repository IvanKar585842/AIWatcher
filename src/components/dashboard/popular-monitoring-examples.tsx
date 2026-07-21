"use client";

import { Lightbulb } from "lucide-react";
import { POPULAR_MONITORING_EXAMPLES } from "@/lib/supported-websites";

/** Compact dashboard help — realistic monitoring examples only. */
export function PopularMonitoringExamples({ className }: { className?: string }) {
  return (
    <div
      className={`rounded-2xl border border-white/[0.06] bg-white/[0.02] px-4 py-4 sm:px-5 ${className ?? ""}`}
    >
      <div className="mb-3 flex items-center gap-2">
        <Lightbulb className="h-4 w-4 text-cyan-400/80" />
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-cyan-500/70">
            Help
          </p>
          <h3 className="text-sm font-medium text-zinc-100">Popular monitoring examples</h3>
        </div>
      </div>
      <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {POPULAR_MONITORING_EXAMPLES.map((example) => (
          <li
            key={example}
            className="rounded-lg border border-white/[0.04] bg-black/25 px-3 py-2 text-xs text-zinc-400"
          >
            {example}
          </li>
        ))}
      </ul>
      <p className="mt-3 text-[11px] leading-relaxed text-zinc-600">
        Best on public HTML pages — docs, news, government, universities, corporate sites, and
        GitHub. Marketplaces and strong anti-bot sites are often unreliable.
      </p>
    </div>
  );
}
