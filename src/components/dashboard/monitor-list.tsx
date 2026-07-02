"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  ExternalLink,
  MoreHorizontal,
  Pause,
  Play,
  RefreshCw,
  Trash2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { CreateMonitorDialog } from "@/components/dashboard/create-monitor-dialog";
import { INTERVAL_LABELS, MODE_LABELS } from "@/lib/constants";
import { formatRelativeTime, getDomainFromUrl } from "@/lib/utils";
import type { Monitor } from "@prisma/client";

interface MonitorWithCount extends Monitor {
  _count: { changes: number };
}

export function MonitorList() {
  const [monitors, setMonitors] = useState<MonitorWithCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState<string | null>(null);

  const fetchMonitors = useCallback(async () => {
    const res = await fetch("/api/monitors");
    const data = await res.json();
    setMonitors(data.monitors ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchMonitors();
  }, [fetchMonitors]);

  async function togglePause(id: string, currentStatus: string) {
    await fetch(`/api/monitors/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status: currentStatus === "ACTIVE" ? "PAUSED" : "ACTIVE",
      }),
    });
    fetchMonitors();
  }

  async function deleteMonitor(id: string) {
    if (!confirm("Delete this monitor and all its history?")) return;
    await fetch(`/api/monitors/${id}`, { method: "DELETE" });
    fetchMonitors();
  }

  async function checkNow(id: string) {
    setChecking(id);
    try {
      await fetch(`/api/monitors/${id}/check`, { method: "POST" });
      fetchMonitors();
    } finally {
      setChecking(null);
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-24 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">
          {monitors.length} Monitor{monitors.length !== 1 ? "s" : ""}
        </h2>
        <CreateMonitorDialog onCreated={fetchMonitors} />
      </div>

      {monitors.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <p className="text-muted-foreground mb-4">No monitors yet. Create your first one!</p>
            <CreateMonitorDialog onCreated={fetchMonitors} />
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {monitors.map((monitor) => (
            <Card key={monitor.id} className="hover:shadow-md transition-shadow">
              <CardContent className="flex items-center justify-between p-4">
                <div className="flex items-start gap-4 min-w-0 flex-1">
                  <div
                    className={`mt-1 h-2.5 w-2.5 rounded-full shrink-0 ${
                      monitor.status === "ACTIVE"
                        ? "bg-green-500"
                        : monitor.status === "PAUSED"
                          ? "bg-amber-500"
                          : "bg-red-500"
                    }`}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Link
                        href={`/dashboard/monitors/${monitor.id}`}
                        className="font-medium hover:underline truncate"
                      >
                        {monitor.name}
                      </Link>
                      <Badge variant="outline" className="text-xs">
                        {MODE_LABELS[monitor.mode]}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground truncate mt-0.5">
                      {getDomainFromUrl(monitor.url)} · {INTERVAL_LABELS[monitor.interval]}
                    </p>
                    <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                      <span>{monitor._count.changes} changes</span>
                      {monitor.lastCheckedAt && (
                        <span>Checked {formatRelativeTime(monitor.lastCheckedAt)}</span>
                      )}
                      {monitor.errorMessage && (
                        <span className="text-destructive truncate">{monitor.errorMessage}</span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0 ml-4">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => checkNow(monitor.id)}
                    disabled={checking === monitor.id}
                    title="Check now"
                  >
                    <RefreshCw
                      className={`h-4 w-4 ${checking === monitor.id ? "animate-spin" : ""}`}
                    />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => togglePause(monitor.id, monitor.status)}
                    title={monitor.status === "ACTIVE" ? "Pause" : "Resume"}
                  >
                    {monitor.status === "ACTIVE" ? (
                      <Pause className="h-4 w-4" />
                    ) : (
                      <Play className="h-4 w-4" />
                    )}
                  </Button>
                  <a href={monitor.url} target="_blank" rel="noopener noreferrer">
                    <Button variant="ghost" size="icon" title="Open website">
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                  </a>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => deleteMonitor(monitor.id)}
                    title="Delete"
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
