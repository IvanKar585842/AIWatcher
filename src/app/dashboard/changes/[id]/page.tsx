"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { DiffViewer } from "@/components/dashboard/diff-viewer";
import { formatDate } from "@/lib/utils";

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
  const [changeId, setChangeId] = useState<string | null>(null);
  const [change, setChange] = useState<ChangeDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    params.then((p) => setChangeId(p.id));
  }, [params]);

  useEffect(() => {
    if (!changeId) return;
    fetch(`/api/changes/${changeId}`)
      .then((r) => r.json())
      .then((data) => setChange(data.change))
      .finally(() => setLoading(false));
  }, [changeId]);

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (!change) {
    return <p className="text-muted-foreground">Change not found.</p>;
  }

  return (
    <div className="space-y-6">
      <Link
        href="/dashboard/history"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to History
      </Link>

      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <span className="text-3xl">{change.emoji}</span>
            <h1 className="text-2xl font-bold">{change.monitor.name}</h1>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="outline">{change.category.replace("_", " ")}</Badge>
            <Badge>{change.importance}</Badge>
            <span className="text-sm text-muted-foreground">{formatDate(change.createdAt)}</span>
          </div>
        </div>
        <a href={change.monitor.url} target="_blank" rel="noopener noreferrer">
          <Button variant="outline">
            <ExternalLink className="h-4 w-4 mr-2" />
            Open Website
          </Button>
        </a>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>AI Summary</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground leading-relaxed">{change.summary}</p>
          {change.bulletPoints.length > 0 && (
            <ul className="space-y-2">
              {change.bulletPoints.map((point, i) => (
                <li key={i} className="flex items-start gap-2 text-sm">
                  <span className="text-blue-500 mt-1">•</span>
                  {point}
                </li>
              ))}
            </ul>
          )}
          {(change.oldValue || change.newValue) && (
            <div className="flex gap-6 p-4 rounded-lg bg-muted/50">
              {change.oldValue && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Before</p>
                  <p className="text-red-500 line-through font-medium">{change.oldValue}</p>
                </div>
              )}
              {change.newValue && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">After</p>
                  <p className="text-green-600 font-medium">{change.newValue}</p>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Diff Viewer</CardTitle>
        </CardHeader>
        <CardContent>
          <DiffViewer
            diffHtml={change.diffHtml}
            oldHtml={change.oldHtml}
            newHtml={change.newHtml}
            oldValue={change.oldValue}
            newValue={change.newValue}
          />
        </CardContent>
      </Card>
    </div>
  );
}
