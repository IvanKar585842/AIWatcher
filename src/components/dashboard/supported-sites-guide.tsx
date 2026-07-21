"use client";

import { useState } from "react";
import { CheckCircle2, ChevronDown, Globe2, ShieldAlert } from "lucide-react";
import {
  ANTIBOT_DISCLAIMER,
  BEST_SUPPORTED_SUMMARY,
  FULLY_SUPPORTED_SITES,
  PARTIALLY_SUPPORTED_SITES,
  UNSUPPORTED_OR_UNSTABLE_SITES,
} from "@/lib/supported-websites";
import { cn } from "@/lib/utils";

/**
 * Create-monitor card: Best supported websites + expandable details.
 * UI only — does not change monitoring behavior.
 */
export function SupportedSitesGuide({ className }: { className?: string }) {
  const [open, setOpen] = useState(false);

  return (
    <div className={cn("space-y-3", className)}>
      <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/[0.06] px-3.5 py-3">
        <div className="mb-2 flex items-center gap-2">
          <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-cyan-300" />
          <p className="text-xs font-medium text-cyan-100">Best supported websites</p>
        </div>
        <ul className="space-y-1">
          {BEST_SUPPORTED_SUMMARY.map((item) => (
            <li key={item} className="flex items-start gap-2 text-[11px] leading-snug text-zinc-400 sm:text-xs">
              <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-cyan-400/70" />
              {item}
            </li>
          ))}
        </ul>
        <p className="mt-2.5 text-[11px] leading-relaxed text-zinc-500">{ANTIBOT_DISCLAIMER}</p>
      </div>

      <div className="overflow-hidden rounded-xl border border-white/[0.06] bg-black/20">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex min-h-11 w-full items-center justify-between gap-3 px-3 py-2.5 text-left transition-colors hover:bg-white/[0.02]"
          aria-expanded={open}
        >
          <span className="flex min-w-0 items-center gap-2">
            <Globe2 className="h-3.5 w-3.5 shrink-0 text-cyan-400/80" />
            <span className="text-xs font-medium text-zinc-300">Supported websites — full list</span>
          </span>
          <ChevronDown
            className={cn(
              "h-3.5 w-3.5 shrink-0 text-zinc-500 transition-transform",
              open && "rotate-180"
            )}
          />
        </button>

        {open && (
          <div className="space-y-3 border-t border-white/[0.05] px-3 py-3 text-[11px] leading-relaxed text-zinc-400 sm:text-xs">
            <div>
              <p className="mb-1 font-medium text-emerald-300/90">Fully supported</p>
              <ul className="list-disc space-y-0.5 pl-4">
                {FULLY_SUPPORTED_SITES.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>

            <div>
              <p className="mb-1 font-medium text-amber-200/90">Partial support</p>
              <ul className="list-disc space-y-0.5 pl-4">
                {PARTIALLY_SUPPORTED_SITES.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>

            <div>
              <p className="mb-1 flex items-center gap-1.5 font-medium text-zinc-300">
                <ShieldAlert className="h-3 w-3" />
                Limited or may be unstable
              </p>
              <ul className="list-disc space-y-0.5 pl-4">
                {UNSUPPORTED_OR_UNSTABLE_SITES.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
