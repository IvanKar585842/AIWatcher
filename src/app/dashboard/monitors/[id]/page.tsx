"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ExternalLink, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { INTERVAL_LABELS, MODE_LABELS, NOTIFICATION_LABELS } from "@/lib/constants";
import { formatDate, formatRelativeTime } from "@/lib/utils";

interface MonitorDetail {
  id: string;
  name: string;
  url: string;
  mode: keyof typeof MODE_LABELS;
  interval: keyof typeof INTERVAL_LABELS;
  notificationMethod: keyof typeof NOTIFICATION_LABELS;
  status: string;
  lastCheckedAt: string | null;
  lastChangedAt: string | null;
  errorMessage: string | null;
  changes: Array<{
    id: string;
    summary: string;
    emoji: string;
    importance: string;
    createdAt: string;
  }>;
  _count: { changes: number; snapshots: number };
}

export default function MonitorDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const [monitorId, setMonitorId] = useState<string | null>(null);
  const [monitor, setMonitor] = useState<MonitorDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    params.then((p) => setMonitorId(p.id));
  }, [params]);

  useEffect(() => {
    if (!monitorId) return;
    fetch(`/api/monitors/${monitorId}`)
      .then((r) => r.json())
      .then((data) => setMonitor(data.monitor))
      .finally(() => setLoading(false));
  }, [monitorId]);

  async function checkNow() {
    if (!monitorId) return;
    setChecking(true);
    await fetch(`/api/monitors/${monitorId}/check`, { method: "POST" });
    const data = await fetch(`/api/monitors/${monitorId}`).then((r) => r.json());
    setMonitor(data.monitor);
    setChecking(false);
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (!monitor) {
    return <p className="text-muted-foreground">Monitor not found.</p>;
  }

  return (
    <div className="space-y-6">
      <Link
        href="/dashboard/monitors"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Monitors
      </Link>

      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{monitor.name}</h1>
          <p className="text-muted-foreground text-sm mt-1 break-all">{monitor.url}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={checkNow} disabled={checking}>
            <RefreshCw className={`h-4 w-4 mr-2 ${checking ? "animate-spin" : ""}`} />
            Check Now
          </Button>
          <a href={monitor.url} target="_blank" rel="noopener noreferrer">
            <Button variant="outline">
              <ExternalLink className="h-4 w-4 mr-2" />
              Open
            </Button>
          </a>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Status</CardTitle>
          </CardHeader>
          <CardContent>
            <Badge variant={monitor.status === "ACTIVE" ? "success" : "secondary"}>
              {monitor.status}
            </Badge>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Mode</CardTitle>
          </CardHeader>
          <CardContent className="font-medium">{MODE_LABELS[monitor.mode]}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Interval</CardTitle>
          </CardHeader>
          <CardContent className="font-medium">{INTERVAL_LABELS[monitor.interval]}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Changes</CardTitle>
          </CardHeader>
          <CardContent className="font-medium">{monitor._count.changes}</CardContent>
        </Card>
      </div>

      {monitor.errorMessage && (
        <Card className="border-destructive">
          <CardContent className="pt-6 text-destructive text-sm">{monitor.errorMessage}</CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Recent Changes</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {monitor.changes.length === 0 ? (
            <p className="text-sm text-muted-foreground">No changes detected yet.</p>
          ) : (
            monitor.changes.map((change) => (
              <Link
                key={change.id}
                href={`/dashboard/changes/${change.id}`}
                className="block p-3 rounded-lg border hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span>{change.emoji}</span>
                    <p className="text-sm truncate">{change.summary}</p>
                  </div>
                  <span className="text-xs text-muted-foreground shrink-0">
                    {formatRelativeTime(change.createdAt)}
                  </span>
                </div>
              </Link>
            ))
          )}
        </CardContent>
      </Card>

      <div className="text-xs text-muted-foreground space-y-1">
        {monitor.lastCheckedAt && (
          <p>Last checked: {formatDate(monitor.lastCheckedAt)}</p>
        )}
        {monitor.lastChangedAt && (
          <p>Last changed: {formatDate(monitor.lastChangedAt)}</p>
        )}
        <p>Notifications: {NOTIFICATION_LABELS[monitor.notificationMethod]}</p>
      </div>
    </div>
  );
}
