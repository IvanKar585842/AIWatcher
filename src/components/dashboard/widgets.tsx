"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Activity, Bell, Globe, Monitor, TrendingUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { formatRelativeTime } from "@/lib/utils";
import Link from "next/link";

interface DashboardStats {
  totalMonitors: number;
  changesToday: number;
  mostActiveWebsite: {
    name: string;
    url: string;
    changeCount: number;
  } | null;
  recentChanges: Array<{
    id: string;
    summary: string;
    emoji: string;
    importance: string;
    createdAt: string;
    monitor: { name: string; url: string };
  }>;
  recentNotifications: Array<{
    id: string;
    channel: string;
    status: string;
    createdAt: string;
    change: { monitor: { name: string } };
  }>;
}

export function DashboardWidgets() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/dashboard/stats")
      .then((r) => r.json())
      .then((data) => setStats(data.stats))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <CardHeader className="pb-2">
              <Skeleton className="h-4 w-24" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-16" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (!stats) return null;

  const widgets = [
    {
      title: "Total Monitors",
      value: stats.totalMonitors,
      icon: Monitor,
      color: "text-blue-500",
    },
    {
      title: "Changes Today",
      value: stats.changesToday,
      icon: Activity,
      color: "text-green-500",
    },
    {
      title: "Most Active",
      value: stats.mostActiveWebsite?.name ?? "—",
      subtitle: stats.mostActiveWebsite
        ? `${stats.mostActiveWebsite.changeCount} changes`
        : undefined,
      icon: TrendingUp,
      color: "text-violet-500",
    },
    {
      title: "Notifications",
      value: stats.recentNotifications.length,
      subtitle: "recent",
      icon: Bell,
      color: "text-amber-500",
    },
  ];

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {widgets.map((widget, i) => (
          <motion.div
            key={widget.title}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
          >
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {widget.title}
                </CardTitle>
                <widget.icon className={`h-4 w-4 ${widget.color}`} />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold truncate">{widget.value}</div>
                {widget.subtitle && (
                  <p className="text-xs text-muted-foreground mt-1">{widget.subtitle}</p>
                )}
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Globe className="h-5 w-5" />
              AI Summaries
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {stats.recentChanges.length === 0 ? (
              <p className="text-sm text-muted-foreground">No changes detected yet.</p>
            ) : (
              stats.recentChanges.map((change) => (
                <Link
                  key={change.id}
                  href={`/dashboard/changes/${change.id}`}
                  className="block p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-2 min-w-0">
                      <span className="text-lg">{change.emoji}</span>
                      <div className="min-w-0">
                        <p className="font-medium text-sm truncate">{change.monitor.name}</p>
                        <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
                          {change.summary}
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <Badge variant="outline" className="text-xs">
                        {change.importance}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {formatRelativeTime(change.createdAt)}
                      </span>
                    </div>
                  </div>
                </Link>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Bell className="h-5 w-5" />
              Recent Notifications
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {stats.recentNotifications.length === 0 ? (
              <p className="text-sm text-muted-foreground">No notifications yet.</p>
            ) : (
              stats.recentNotifications.map((notif) => (
                <div
                  key={notif.id}
                  className="flex items-center justify-between p-3 rounded-lg border"
                >
                  <div>
                    <p className="text-sm font-medium">{notif.change.monitor.name}</p>
                    <p className="text-xs text-muted-foreground">
                      via {notif.channel} · {formatRelativeTime(notif.createdAt)}
                    </p>
                  </div>
                  <Badge
                    variant={notif.status === "SENT" ? "success" : notif.status === "FAILED" ? "destructive" : "secondary"}
                  >
                    {notif.status}
                  </Badge>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
