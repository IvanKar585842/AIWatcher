"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bell } from "lucide-react";
import { useToast } from "@/components/ui/os-toast";
import {
  getReadNotificationIds,
  markAlertOpened,
  markNotificationsRead,
  READ_STATE_EVENT,
} from "@/lib/notification-read-state";
import { formatRelativeTime } from "@/lib/utils";

interface NotificationItem {
  id: string;
  channel: string;
  status: string;
  createdAt: string;
  change: {
    id: string;
    summary: string;
    emoji: string;
    importance?: string;
    monitor: { name: string };
  };
}

export function NotificationDropdown() {
  const router = useRouter();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [readIds, setReadIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const knownIdsRef = useRef<Set<string>>(new Set());
  const initializedRef = useRef(false);

  const syncReadIds = useCallback(() => {
    setReadIds(getReadNotificationIds());
  }, []);

  const loadNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/notifications?lean=1&limit=15");
      if (!res.ok) return;
      const data = await res.json();
      const items: NotificationItem[] = data.notifications ?? [];

      if (initializedRef.current) {
        const read = getReadNotificationIds();
        for (const item of items) {
          if (!knownIdsRef.current.has(item.id) && !read.has(item.id)) {
            toast(`${item.change.emoji} ${item.change.monitor.name}: ${item.change.summary}`, "success");
          }
        }
      } else {
        initializedRef.current = true;
      }

      knownIdsRef.current = new Set(items.map((n) => n.id));
      setNotifications(items);
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    syncReadIds();
    loadNotifications();
    const interval = setInterval(loadNotifications, 30_000);
    window.addEventListener(READ_STATE_EVENT, syncReadIds);
    window.addEventListener("storage", syncReadIds);
    return () => {
      clearInterval(interval);
      window.removeEventListener(READ_STATE_EVENT, syncReadIds);
      window.removeEventListener("storage", syncReadIds);
    };
  }, [loadNotifications, syncReadIds]);

  useEffect(() => {
    if (open) loadNotifications();
  }, [open, loadNotifications]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [open]);

  const unreadCount = notifications.filter((n) => !readIds.has(n.id)).length;

  function handleNotificationClick(item: NotificationItem) {
    markAlertOpened({
      notificationId: item.id,
      changeId: item.change.id,
    });
    syncReadIds();
    setOpen(false);
    router.push(`/dashboard/changes/${item.change.id}`);
  }

  function markAllRead() {
    markNotificationsRead(notifications.map((n) => n.id));
    syncReadIds();
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="relative flex min-h-10 min-w-10 items-center justify-center rounded-full border border-white/[0.06] text-zinc-400 transition-colors hover:border-cyan-400/20 hover:text-cyan-300"
        aria-label="Notifications"
        aria-expanded={open}
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-cyan-500 text-[9px] font-bold text-black">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="fixed inset-x-3 top-[3.75rem] z-50 max-h-[min(70vh,28rem)] overflow-hidden rounded-xl border border-white/[0.08] bg-[#111111] shadow-[0_20px_60px_-15px_rgba(0,0,0,0.8)] sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:mt-2 sm:w-80 sm:max-h-none">
          <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-3">
            <p className="text-sm font-medium text-zinc-200">Notifications</p>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={markAllRead}
                className="min-h-9 px-2 text-[11px] text-cyan-400/80 hover:text-cyan-300"
              >
                Mark all read
              </button>
            )}
          </div>

          <div className="max-h-[min(55vh,20rem)] overflow-y-auto overscroll-contain scroll-smooth scrollbar-none sm:max-h-80">
            {loading && notifications.length === 0 && (
              <p className="px-4 py-6 text-center text-xs text-zinc-600">Loading...</p>
            )}

            {!loading && notifications.length === 0 && (
              <p className="px-4 py-6 text-center text-xs text-zinc-600">
                No alerts yet — changes on monitored sites will appear here
              </p>
            )}

            {notifications.map((item) => {
              const isUnread = !readIds.has(item.id);
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleNotificationClick(item)}
                  className={`flex w-full gap-3 border-b border-white/[0.04] px-4 py-3.5 text-left transition-colors hover:bg-white/[0.03] active:bg-white/[0.05] ${
                    isUnread ? "bg-cyan-500/[0.04]" : ""
                  }`}
                >
                  <span className="text-lg">{item.change.emoji}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-medium text-zinc-200">
                        {item.change.monitor.name}
                      </p>
                      {isUnread && (
                        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-cyan-400" />
                      )}
                    </div>
                    <p className="mt-0.5 line-clamp-2 text-xs text-zinc-500">
                      {item.change.summary}
                    </p>
                    <p className="mt-1 text-[10px] text-zinc-600">
                      {item.channel === "IN_APP"
                        ? "On site"
                        : item.channel === "EMAIL"
                          ? "Email"
                          : item.channel === "TELEGRAM"
                            ? "Telegram"
                            : item.channel}{" "}
                      · {formatRelativeTime(item.createdAt)}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>

          <div className="border-t border-white/[0.06] px-4 py-2">
            <Link
              href="/dashboard/notifications"
              onClick={() => setOpen(false)}
              className="flex min-h-10 items-center justify-center text-center text-[11px] text-cyan-400/80 hover:text-cyan-300"
            >
              View all notifications
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
