"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ChangeInsightBrief } from "@/components/dashboard/change-insight-brief";
import { DiffViewer } from "@/components/dashboard/diff-viewer";
import { EmptyState } from "@/components/dashboard/command/dashboard-skeletons";
import { ShareInsightButton } from "@/components/dashboard/share-insight-report";
import { UpgradePrompt } from "@/components/dashboard/upgrade-prompt";
import { defaultCategoryLabel, formatImportanceEstimate } from "@/lib/ai/change-insight";
import { markAlertOpened } from "@/lib/notification-read-state";
import { MODE_LABELS } from "@/lib/constants";
import { FileQuestion } from "lucide-react";
import type { MonitoringMode } from "@prisma/client";

interface ScreenshotPayload {
  mime?: string;
  data?: string;
}

interface ChangeDetail {
  id: string;
  summary: string;
  emoji: string;
  importance: string;
  category: string;
  categoryLabel?: string | null;
  potentialImpact?: string | null;
  recommendedAction?: string | null;
  oldValue: string | null;
  newValue: string | null;
  bulletPoints: string[];
  diffHtml: string | null;
  oldHtml: string | null;
  newHtml: string | null;
  createdAt: string;
  visualDiffPercent?: number | null;
  previousScreenshot?: ScreenshotPayload | null;
  currentScreenshot?: ScreenshotPayload | null;
  structureSummary?: string[];
  comparisonReason?: string | null;
  upgradePreview?: boolean;
  upgradeTitle?: string | null;
  upgradeDescription?: string | null;
  monitor: { id: string; name: string; url: string; mode?: string };
}

function screenshotSrc(shot?: ScreenshotPayload | null): string | null {
  if (!shot?.data) return null;
  const mime = shot.mime || "image/jpeg";
  return `data:${mime};base64,${shot.data}`;
}

export default function ChangeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: changeId } = use(params);
  const [change, setChange] = useState<ChangeDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

    useEffect(() => {
    if (!changeId) return;
    // Opening a change detail clears matching important-alert / notification unread state
    markAlertOpened({ changeId });
  }, [changeId]);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setNotFound(false);

    fetch(`/api/changes/${changeId}`, { signal: controller.signal })
      .then((r) => {
        if (r.status === 404) {
          setNotFound(true);
          return null;
        }
        if (!r.ok) throw new Error("Failed");
        return r.json();
      })
      .then((data) => {
        if (data?.change) setChange(data.change);
      })
      .catch((err) => {
        if (err.name !== "AbortError") setNotFound(true);
      })
      .finally(() => setLoading(false));

    return () => controller.abort();
  }, [changeId]);

  if (loading) {
    return (
      <div className="space-y-4 p-4 lg:p-6">
        <Skeleton className="h-8 w-48 bg-white/5" />
        <Skeleton className="h-32 w-full bg-white/5" />
        <Skeleton className="h-96 w-full bg-white/5" />
      </div>
    );
  }

  if (notFound || !change) {
    return (
      <div className="p-4 lg:p-6">
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02]">
          <EmptyState
            icon={FileQuestion}
            title="Change not found"
            description="This change may have been deleted or you don't have access to it."
            action={
              <Link
                href="/dashboard/history"
                className="inline-flex items-center gap-1.5 rounded-full border border-cyan-400/25 bg-cyan-500/10 px-4 py-2 text-xs text-cyan-100"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Back to History
              </Link>
            }
          />
        </div>
      </div>
    );
  }

  const beforeSrc = screenshotSrc(change.previousScreenshot);
  const afterSrc = screenshotSrc(change.currentScreenshot);
  const modeLabel = change.monitor.mode
    ? MODE_LABELS[change.monitor.mode as MonitoringMode] ?? change.monitor.mode
    : change.category.replace(/_/g, " ");
  const estimate = formatImportanceEstimate(change.importance);
  const categoryLabel =
    change.categoryLabel?.trim() || defaultCategoryLabel(change.category);

  return (
    <div className="space-y-6 p-4 lg:p-6">
      <Link
        href="/dashboard/history"
        className="inline-flex items-center gap-1 font-mono text-xs uppercase tracking-wider text-zinc-500 transition-colors hover:text-cyan-400"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to History
      </Link>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="mb-2 flex items-start gap-3">
            <span className="text-3xl">{change.emoji}</span>
            <h1 className="text-xl font-bold tracking-tight text-zinc-100 sm:text-2xl">
              {change.monitor.name}
            </h1>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">
              {estimate.emoji} {estimate.label}
            </Badge>
            <Badge variant="outline">{categoryLabel}</Badge>
            <Badge variant="outline">{modeLabel}</Badge>
            {change.comparisonReason && (
              <Badge variant="secondary">{String(change.comparisonReason).replace(/_/g, " ")}</Badge>
            )}
          </div>
        </div>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
          <ShareInsightButton
            insight={{
              monitorName: change.monitor.name,
              monitorUrl: change.monitor.url,
              summary: change.summary,
              importance: change.importance,
              bulletPoints: change.bulletPoints,
              createdAt: change.createdAt,
              emoji: change.emoji,
              category: change.category,
              potentialImpact: change.potentialImpact ?? undefined,
            }}
          />
          <a href={change.monitor.url} target="_blank" rel="noopener noreferrer" className="shrink-0">
            <Button
              variant="outline"
              className="w-full min-h-11 border-white/[0.08] bg-black/30 text-zinc-300 sm:w-auto"
            >
              <ExternalLink className="mr-2 h-4 w-4" />
              Open Site
            </Button>
          </a>
        </div>
      </div>

      <Card className="border-cyan-500/15 bg-gradient-to-br from-cyan-500/[0.04] via-white/[0.02] to-transparent">
        <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-cyan-500/70">
              AI change analysis
            </p>
            <CardTitle className="mt-1 text-zinc-100">Structured change report</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <ChangeInsightBrief
            monitorName={change.monitor.name}
            monitorUrl={change.monitor.url}
            summary={change.summary}
            bulletPoints={change.bulletPoints}
            importance={change.importance}
            category={change.category}
            categoryLabel={categoryLabel}
            potentialImpact={change.potentialImpact}
            recommendedAction={change.recommendedAction}
            createdAt={change.createdAt}
            emoji={change.emoji}
          />
          {change.recommendedAction && change.potentialImpact && (
            <div className="mt-5 rounded-lg border border-white/[0.06] bg-black/20 p-3">
              <p className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">
                Recommended action
              </p>
              <p className="mt-1.5 text-sm text-zinc-300">{change.recommendedAction}</p>
            </div>
          )}
          <p className="mt-5 font-mono text-[10px] uppercase tracking-wider text-zinc-600">
            Generated by WatchFlowing AI
          </p>
          {change.upgradePreview && (
            <div className="mt-5">
              <UpgradePrompt
                title={
                  change.upgradeTitle ??
                  "AI detected that this change could be analyzed automatically"
                }
                description={
                  change.upgradeDescription ??
                  "Upgrade to Pro to understand which changes are important — and skip the noise."
                }
              />
            </div>
          )}
          {change.structureSummary && change.structureSummary.length > 0 && (
            <div className="mt-4 rounded-lg border border-white/[0.06] bg-black/20 p-3">
              <p className="mb-2 font-mono text-[10px] uppercase tracking-widest text-zinc-500">
                Detected structure
              </p>
              <ul className="space-y-1 text-sm text-zinc-400">
                {change.structureSummary.map((line) => (
                  <li key={line}>• {line}</li>
                ))}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>

      {(beforeSrc || afterSrc) && (
        <Card className="border-white/[0.06] bg-white/[0.02]">
          <CardHeader>
            <CardTitle className="text-zinc-100">
              Screenshot comparison
              {change.visualDiffPercent != null
                ? ` · ~${change.visualDiffPercent.toFixed(1)}% difference`
                : ""}
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div>
              <p className="mb-2 font-mono text-[10px] uppercase tracking-widest text-zinc-500">
                Before
              </p>
              {beforeSrc ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={beforeSrc}
                  alt="Previous screenshot"
                  className="w-full rounded-lg border border-white/[0.08] bg-black/40"
                />
              ) : (
                <p className="text-sm text-zinc-600">No previous screenshot stored</p>
              )}
            </div>
            <div>
              <p className="mb-2 font-mono text-[10px] uppercase tracking-widest text-zinc-500">
                After
              </p>
              {afterSrc ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={afterSrc}
                  alt="Current screenshot"
                  className="w-full rounded-lg border border-white/[0.08] bg-black/40"
                />
              ) : (
                <p className="text-sm text-zinc-600">No current screenshot stored</p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {(change.oldValue || change.newValue) && (
        <Card className="border-white/[0.06] bg-white/[0.02]">
          <CardHeader>
            <CardTitle className="text-zinc-100">Value Change</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            {change.oldValue && (
              <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-3">
                <p className="mb-1 font-mono text-xs uppercase text-zinc-500">Before</p>
                <p className="text-sm text-zinc-300">{change.oldValue}</p>
              </div>
            )}
            {change.newValue && (
              <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3">
                <p className="mb-1 font-mono text-xs uppercase text-zinc-500">After</p>
                <p className="text-sm text-zinc-300">{change.newValue}</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {change.diffHtml && !beforeSrc && (
        <Card className="border-white/[0.06] bg-white/[0.02]">
          <CardHeader>
            <CardTitle className="text-zinc-100">Diff</CardTitle>
          </CardHeader>
          <CardContent>
            <DiffViewer diffHtml={change.diffHtml} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
