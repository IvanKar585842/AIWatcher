"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  Bell,
  CheckCheck,
  ExternalLink,
  Mail,
  MessageCircle,
  Search,
} from "lucide-react";
import { CommandPageHeader } from "@/components/dashboard/command/command-page-header";
import { Badge } from "@/components/ui/badge";
import {
  getReadNotificationIds,
  markAlertOpened,
  markImportantChangesRead,
  markNotificationsRead,
  READ_STATE_EVENT,
} from "@/lib/notification-read-state";
import { formatRelativeTime } from "@/lib/utils";
import { MODE_LABELS } from "@/lib/constants";
import type { MonitoringMode } from "@prisma/client";

interface NotificationItem {
  id: string;
  channel: string;
  status: string;
  createdAt: string;
  change: {
    id: string;
    summary: string;
    emoji: string;
    importance: string;
    category: string;
    bulletPoints: string[];
    oldValue: string | null;
    newValue: string | null;
    recommendedAction?: string;
    createdAt: string;
    monitor: { name: string; url: string; mode?: string };
  };
}

function importanceVariant(imp: string) {
  switch (imp) {
    case "CRITICAL":
      return "destructive" as const;
    case "HIGH":
      return "warning" as const;
    case "MEDIUM":
      return "default" as const;
    default:
      return "secondary" as const;
  }
}

export default function NotificationsPage() {
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [importance, setImportance] = useState("all");
  const [channel, setChannel] = useState("all");
  const [readIds, setReadIds] = useState<Set<string>>(new Set());
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ limit: "50" });
    if (query.trim()) params.set("q", query.trim());
    if (importance !== "all") params.set("importance", importance);
    if (channel !== "all") params.set("channel", channel);

    try {
      const res = await fetch(`/api/notifications?${params}`);
      const data = await res.json();
      setItems(data.notifications ?? []);
    } finally {
      setLoading(false);
    }
  }, [query, importance, channel]);

  useEffect(() => {
    setReadIds(getReadNotificationIds());
    function sync() {
      setReadIds(getReadNotificationIds());
    }
    window.addEventListener(READ_STATE_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(READ_STATE_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  useEffect(() => {
    const t = setTimeout(() => {
      void load();
    }, 200);
    return () => clearTimeout(t);
  }, [load]);

  const unreadCount = useMemo(
    () => items.filter((i) => !readIds.has(i.id)).length,
    [items, readIds]
  );

  function markRead(item: NotificationItem) {
    markAlertOpened({
      notificationId: item.id,
      changeId: item.change.id,
    });
    setReadIds(getReadNotificationIds());
  }

  function markAllRead() {
    markNotificationsRead(items.map((i) => i.id));
    const highChangeIds = items
      .filter((i) => i.change.importance === "HIGH" || i.change.importance === "CRITICAL")
      .map((i) => i.change.id);
    if (highChangeIds.length > 0) {
      markImportantChangesRead(highChangeIds);
    }
    setReadIds(getReadNotificationIds());
  }

  return (
    <div className="p-4 lg:p-6">
      <CommandPageHeader
        label="Alerts"
        title="Notification Center"
        description="AI-powered alerts with importance, summaries, and recommended actions."
      >
        {unreadCount > 0 && (
          <button
            type="button"
            onClick={markAllRead}
            className="inline-flex min-h-10 items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.03] px-4 text-xs text-zinc-400 hover:border-cyan-400/20 hover:text-cyan-200"
          >
            <CheckCheck className="h-3.5 w-3.5" />
            Mark all read ({unreadCount})
          </button>
        )}
      </CommandPageHeader>

      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <div className="relative min-w-0 flex-1 sm:max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-600" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search monitors or summaries…"
            className="h-11 w-full rounded-xl border border-white/[0.08] bg-black/40 pl-10 pr-3 text-sm text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-cyan-400/30"
          />
        </div>
        <select
          value={importance}
          onChange={(e) => setImportance(e.target.value)}
          className="h-11 rounded-xl border border-white/[0.08] bg-black/40 px-3 text-sm text-zinc-300 outline-none focus:border-cyan-400/30"
          aria-label="Filter by importance"
        >
          <option value="all">All importance</option>
          <option value="CRITICAL">Critical</option>
          <option value="HIGH">High</option>
          <option value="MEDIUM">Medium</option>
          <option value="LOW">Low</option>
        </select>
        <select
          value={channel}
          onChange={(e) => setChannel(e.target.value)}
          className="h-11 rounded-xl border border-white/[0.08] bg-black/40 px-3 text-sm text-zinc-300 outline-none focus:border-cyan-400/30"
          aria-label="Filter by channel"
        >
          <option value="all">All channels</option>
          <option value="IN_APP">In-app</option>
          <option value="EMAIL">Email</option>
          <option value="TELEGRAM">Telegram</option>
        </select>
      </div>

      <div className="space-y-3">
        {loading &&
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-28 animate-pulse rounded-2xl bg-white/[0.03]" />
          ))}

        {!loading && items.length === 0 && (
          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] px-6 py-14 text-center">
            <Bell className="mx-auto h-8 w-8 text-cyan-400/50" />
            <p className="mt-4 text-sm font-medium text-zinc-200">
              Your AI monitoring feed will appear here
            </p>
            <p className="mx-auto mt-2 max-w-sm text-xs leading-relaxed text-zinc-500">
              WatchFlowing will analyze important changes and explain what requires attention.
              Adjust filters if you&apos;re looking for a specific channel.
            </p>
          </div>
        )}

        {items.map((item, i) => {
          const isUnread = !readIds.has(item.id);
          const isExpanded = expandedId === item.id;
          const modeLabel = item.change.monitor.mode
            ? MODE_LABELS[item.change.monitor.mode as MonitoringMode] ??
              item.change.monitor.mode
            : item.change.category.replace(/_/g, " ");
          const title =
            item.change.bulletPoints?.[0] ||
            `${item.change.monitor.name} changed`;

          return (
            <motion.article
              key={item.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(i * 0.04, 0.3) }}
              className={`rounded-2xl border p-4 transition-colors ${
                isUnread
                  ? "border-cyan-400/20 bg-cyan-500/[0.04]"
                  : "border-white/[0.06] bg-white/[0.02]"
              }`}
            >
              <div className="flex items-start gap-3 sm:gap-4">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/[0.06] bg-[#090909] text-lg">
                  {item.change.emoji}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-medium text-zinc-100">{title}</h3>
                    {isUnread && (
                      <span className="h-1.5 w-1.5 rounded-full bg-cyan-400" title="Unread" />
                    )}
                    <Badge variant={importanceVariant(item.change.importance)} className="text-[10px]">
                      {item.change.importance}
                    </Badge>
                    <span className="font-mono text-[10px] uppercase tracking-wider text-zinc-600">
                      {modeLabel}
                    </span>
                  </div>

                  <p className="mt-1 text-xs text-zinc-500">
                    {item.change.monitor.name} · {formatRelativeTime(item.createdAt)}
                  </p>

                  <p className="mt-2 text-[11px] font-medium uppercase tracking-wider text-zinc-600">
                    AI summary
                  </p>
                  <p className="mt-1 line-clamp-2 text-sm text-zinc-300">{item.change.summary}</p>

                  {item.change.recommendedAction && (
                    <p className="mt-2 rounded-lg border border-cyan-500/15 bg-cyan-500/[0.05] px-3 py-2 text-xs text-cyan-100/90">
                      <span className="font-medium text-cyan-300">Action: </span>
                      {item.change.recommendedAction}
                    </p>
                  )}

                  {isExpanded && (
                    <div className="mt-3 space-y-2 rounded-xl border border-white/[0.06] bg-black/30 p-3">
                      <p className="text-[11px] font-medium uppercase tracking-wider text-zinc-600">
                        Original change details
                      </p>
                      {(item.change.bulletPoints ?? []).length > 0 ? (
                        <ul className="space-y-1">
                          {item.change.bulletPoints.map((bp) => (
                            <li key={bp} className="flex gap-2 text-xs text-zinc-400">
                              <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-cyan-400/70" />
                              {bp}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-xs text-zinc-500">{item.change.summary}</p>
                      )}
                      {(item.change.oldValue || item.change.newValue) && (
                        <div className="flex flex-wrap gap-3 pt-1 text-xs">
                          {item.change.oldValue && (
                            <span className="text-red-400/90 line-through">
                              {item.change.oldValue}
                            </span>
                          )}
                          {item.change.newValue && (
                            <span className="font-medium text-emerald-400">
                              {item.change.newValue}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        markRead(item);
                        setExpandedId(isExpanded ? null : item.id);
                      }}
                      className="min-h-9 rounded-lg border border-white/[0.08] px-3 text-xs text-zinc-400 hover:text-zinc-200"
                    >
                      {isExpanded ? "Hide details" : "Show original change"}
                    </button>
                    <Link
                      href={`/dashboard/changes/${item.change.id}`}
                      onClick={() => markRead(item)}
                      className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-cyan-400/25 bg-cyan-500/10 px-3 text-xs text-cyan-200 hover:bg-cyan-500/15"
                    >
                      Open details
                      <ExternalLink className="h-3 w-3" />
                    </Link>
                    {isUnread && (
                      <button
                        type="button"
                        onClick={() => markRead(item)}
                        className="min-h-9 rounded-lg px-3 text-xs text-zinc-600 hover:text-zinc-300"
                      >
                        Mark read
                      </button>
                    )}
                    <span className="ml-auto inline-flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-zinc-600">
                      {item.channel === "EMAIL" ? (
                        <Mail className="h-3 w-3" />
                      ) : item.channel === "TELEGRAM" ? (
                        <MessageCircle className="h-3 w-3" />
                      ) : (
                        <Bell className="h-3 w-3" />
                      )}
                      {item.channel === "IN_APP"
                        ? "In-app"
                        : item.channel === "EMAIL"
                          ? "Email"
                          : item.channel === "TELEGRAM"
                            ? "Telegram"
                            : item.channel}
                      · {item.status}
                    </span>
                  </div>
                </div>
              </div>
            </motion.article>
          );
        })}
      </div>
    </div>
  );
}
