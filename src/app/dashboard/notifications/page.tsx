"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Bell, Mail, MessageCircle } from "lucide-react";
import { CommandPageHeader } from "@/components/dashboard/command/command-page-header";
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
    monitor: { name: string };
  };
}

export default function NotificationsPage() {
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/dashboard/stats")
      .then((r) => r.json())
      .then((data) => {
        const notifs = (data.stats?.recentNotifications ?? []).map(
          (n: NotificationItem & { change: NotificationItem["change"] }) => ({
            ...n,
            change: n.change,
          })
        );
        setItems(notifs);
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="p-4 lg:p-6">
      <CommandPageHeader
        label="Alerts"
        title="Notification Center"
        description="Delivery status for email and Telegram alerts."
      />

      <div className="space-y-3">
        {loading &&
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-20 animate-pulse rounded-2xl bg-white/[0.03]" />
          ))}

        {!loading && items.length === 0 && (
          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-12 text-center">
            <Bell className="mx-auto h-8 w-8 text-zinc-700" />
            <p className="mt-4 text-sm text-zinc-500">No notifications yet</p>
          </div>
        )}

        {items.map((item, i) => (
          <motion.div
            key={item.id}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
          >
            <Link
              href={`/dashboard/changes/${item.change.id}`}
              className="group flex items-start gap-4 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4 transition-colors hover:border-cyan-400/15 hover:bg-white/[0.03]"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/[0.06] bg-[#090909] text-lg">
                {item.change.emoji}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium text-zinc-200 group-hover:text-cyan-100">
                    {item.change.monitor.name}
                  </p>
                  <span
                    className={`rounded-full px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider ${
                      item.status === "SENT"
                        ? "border border-emerald-500/20 bg-emerald-500/10 text-emerald-300"
                        : item.status === "FAILED"
                          ? "border border-red-500/20 bg-red-500/10 text-red-300"
                          : "border border-zinc-600/30 bg-zinc-800/30 text-zinc-400"
                    }`}
                  >
                    {item.status}
                  </span>
                </div>
                <p className="mt-1 line-clamp-2 text-sm text-zinc-500">{item.change.summary}</p>
                <div className="mt-2 flex items-center gap-3 text-xs text-zinc-600">
                  {item.channel === "EMAIL" ? (
                    <Mail className="h-3 w-3" />
                  ) : (
                    <MessageCircle className="h-3 w-3" />
                  )}
                  <span>{item.channel}</span>
                  <span>·</span>
                  <span>{formatRelativeTime(item.createdAt)}</span>
                </div>
              </div>
            </Link>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
