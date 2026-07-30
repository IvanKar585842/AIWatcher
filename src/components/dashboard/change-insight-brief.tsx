"use client";

import {
  defaultCategoryLabel,
  formatImportanceEstimate,
  hostnameFromUrl,
} from "@/lib/ai/change-insight";
import { cn, formatDate } from "@/lib/utils";

export interface ChangeInsightData {
  monitorName: string;
  monitorUrl: string;
  summary: string;
  bulletPoints: string[];
  importance: string;
  category: string;
  categoryLabel?: string | null;
  potentialImpact?: string | null;
  recommendedAction?: string | null;
  where?: string | null;
  whyItMatters?: string | null;
  riskLevel?: string | null;
  possibleReason?: string | null;
  sectionsAdded?: string[];
  sectionsRemoved?: string[];
  visualDifferences?: string[];
  structureDifferences?: string[];
  linksChanged?: string[];
  buttonsChanged?: string[];
  textChanged?: string[];
  metadataChanged?: string[];
  createdAt: string;
  emoji?: string;
  compact?: boolean;
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-zinc-500">
      {children}
    </p>
  );
}

export function ChangeInsightBrief({
  monitorName,
  monitorUrl,
  summary,
  bulletPoints,
  importance,
  category,
  categoryLabel,
  potentialImpact,
  recommendedAction,
  where,
  whyItMatters,
  riskLevel,
  possibleReason,
  sectionsAdded = [],
  sectionsRemoved = [],
  visualDifferences = [],
  structureDifferences = [],
  linksChanged = [],
  buttonsChanged = [],
  textChanged = [],
  metadataChanged = [],
  createdAt,
  emoji,
  compact = false,
}: ChangeInsightData) {
  const host = hostnameFromUrl(monitorUrl);
  const estimate = formatImportanceEstimate(importance);
  const label = categoryLabel?.trim() || defaultCategoryLabel(category);
  const bullets = bulletPoints.filter(Boolean);

  return (
    <div className={cn("space-y-5", compact && "space-y-3")}>
      <div className={cn("grid gap-4", compact ? "sm:grid-cols-2" : "sm:grid-cols-2")}>
        <div>
          <SectionLabel>Website</SectionLabel>
          <p className={cn("mt-1.5 font-medium text-zinc-100", compact ? "text-sm" : "text-base")}>
            {emoji ? <span className="mr-2">{emoji}</span> : null}
            {host}
          </p>
          <p className="mt-0.5 truncate text-xs text-zinc-600">{monitorName}</p>
        </div>
        <div>
          <SectionLabel>Detected at</SectionLabel>
          <p className={cn("mt-1.5 text-zinc-200", compact ? "text-sm" : "text-base")}>
            {formatDate(createdAt)}
          </p>
        </div>
      </div>

      <div>
        <SectionLabel>Summary</SectionLabel>
        <p
          className={cn(
            "mt-2 leading-relaxed text-zinc-200",
            compact ? "line-clamp-4 text-sm" : "text-[15px]"
          )}
        >
          {summary}
        </p>
      </div>

      {bullets.length > 0 && (
        <div>
          <SectionLabel>What changed</SectionLabel>
          <ul className="mt-2.5 space-y-2">
            {bullets.map((point) => (
              <li
                key={point}
                className={cn(
                  "flex items-start gap-2.5 text-zinc-400",
                  compact ? "text-xs" : "text-sm"
                )}
              >
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-cyan-400/80" />
                <span className={compact ? "line-clamp-2" : undefined}>{point}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <SectionLabel>Estimated importance</SectionLabel>
          <p className="mt-2 text-sm font-medium text-zinc-100">
            <span className="mr-1.5" aria-hidden>
              {estimate.emoji}
            </span>
            {estimate.label}
            {importance === "CRITICAL" ? " (urgent)" : ""}
          </p>
          <p className="mt-1 text-xs capitalize text-zinc-600">
            Category · {label}
          </p>
        </div>
        {(potentialImpact || recommendedAction) && (
          <div>
            <SectionLabel>Potential impact</SectionLabel>
            <p className={cn("mt-2 leading-relaxed text-zinc-300", compact ? "text-xs line-clamp-3" : "text-sm")}>
              {potentialImpact || recommendedAction}
            </p>
          </div>
        )}
      </div>

      {(where || whyItMatters || riskLevel || possibleReason) && (
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <SectionLabel>Where</SectionLabel>
            <p className={cn("mt-2 leading-relaxed text-zinc-300", compact ? "text-xs" : "text-sm")}>
              {where || "Not reliably identified"}
            </p>
          </div>
          <div>
            <SectionLabel>Risk level</SectionLabel>
            <p className={cn("mt-2 font-medium", compact ? "text-xs" : "text-sm")}>
              <span className={riskLevel === "CRITICAL" || riskLevel === "HIGH" ? "text-amber-300" : "text-zinc-200"}>
                {riskLevel || "Not assessed"}
              </span>
            </p>
          </div>
          {whyItMatters && (
            <div>
              <SectionLabel>Why it matters</SectionLabel>
              <p className={cn("mt-2 leading-relaxed text-zinc-300", compact ? "text-xs" : "text-sm")}>
                {whyItMatters}
              </p>
            </div>
          )}
          {possibleReason && (
            <div>
              <SectionLabel>Possible reason</SectionLabel>
              <p className={cn("mt-2 leading-relaxed text-zinc-400", compact ? "text-xs" : "text-sm")}>
                {possibleReason}
              </p>
            </div>
          )}
        </div>
      )}

      {[
        ["Sections added", sectionsAdded],
        ["Sections removed", sectionsRemoved],
        ["Visual differences", visualDifferences],
        ["Structure differences", structureDifferences],
        ["Links changed", linksChanged],
        ["Buttons changed", buttonsChanged],
        ["Text changed", textChanged],
        ["Metadata changed", metadataChanged],
      ].filter(([, items]) => items.length > 0).length > 0 && (
        <div>
          <SectionLabel>Detailed findings</SectionLabel>
          <div className="mt-2.5 grid gap-3 sm:grid-cols-2">
            {[
              ["Sections added", sectionsAdded],
              ["Sections removed", sectionsRemoved],
              ["Visual differences", visualDifferences],
              ["Structure differences", structureDifferences],
              ["Links changed", linksChanged],
              ["Buttons changed", buttonsChanged],
              ["Text changed", textChanged],
              ["Metadata changed", metadataChanged],
            ].map(([label, items]) =>
              (items as string[]).length > 0 ? (
                <div key={label as string} className="rounded-lg border border-white/[0.06] bg-black/20 p-3">
                  <p className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">{label as string}</p>
                  <ul className="mt-1.5 space-y-1 text-xs leading-relaxed text-zinc-400">
                    {(items as string[]).map((item) => <li key={item}>• {item}</li>)}
                  </ul>
                </div>
              ) : null
            )}
          </div>
        </div>
      )}
    </div>
  );
}
