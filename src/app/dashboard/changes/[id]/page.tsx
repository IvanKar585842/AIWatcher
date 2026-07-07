"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { DiffViewer } from "@/components/dashboard/diff-viewer";
import { EmptyState } from "@/components/dashboard/command/dashboard-skeletons";
import { formatDate } from "@/lib/utils";
import { FileQuestion } from "lucide-react";

interface ChangeDetail {
  id: string;
  summary: string;
  emoji: string;
  importance: string;
  category: string;
  oldValue: string | null;
  newValue: string | null;
  bulletPoints: string[];
  diffHtml: string | null;
  oldHtml: string | null;
  newHtml: string | null;
  createdAt: string;
  monitor: { id: string; name: string; url: string };
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

  return (
    <div className="space-y-6 p-4 lg:p-6">
      <Link
        href="/dashboard/history"
        className="inline-flex items-center gap-1 font-mono text-xs uppercase tracking-wider text-zinc-500 transition-colors hover:text-cyan-400"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to History
      </Link>

      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <span className="text-3xl">{change.emoji}</span>
            <h1 className="text-2xl font-bold text-zinc-100">{change.monitor.name}</h1>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="outline">{change.importance}</Badge>
            <Badge variant="outline">{change.category}</Badge>
            <span className="text-xs text-zinc-500">{formatDate(change.createdAt)}</span>
          </div>
        </div>
        <a href={change.monitor.url} target="_blank" rel="noopener noreferrer">
          <Button variant="outline" className="border-white/[0.08] bg-black/30 text-zinc-300">
            <ExternalLink className="h-4 w-4 mr-2" />
            Open Site
          </Button>
        </a>
      </div>

      <Card className="border-white/[0.06] bg-white/[0.02]">
        <CardHeader>
          <CardTitle className="text-zinc-100">AI Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-zinc-300">{change.summary}</p>
          {change.bulletPoints.length > 0 && (
            <ul className="mt-4 space-y-2">
              {change.bulletPoints.map((point, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-zinc-400">
                  <span className="text-cyan-400 mt-0.5">•</span>
                  {point}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {(change.oldValue || change.newValue) && (
        <Card className="border-white/[0.06] bg-white/[0.02]">
          <CardHeader>
            <CardTitle className="text-zinc-100">Value Change</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            {change.oldValue && (
              <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-3">
                <p className="text-xs font-mono uppercase text-zinc-500 mb-1">Before</p>
                <p className="text-sm text-zinc-300">{change.oldValue}</p>
              </div>
            )}
            {change.newValue && (
              <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3">
                <p className="text-xs font-mono uppercase text-zinc-500 mb-1">After</p>
                <p className="text-sm text-zinc-300">{change.newValue}</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {change.diffHtml && (
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
