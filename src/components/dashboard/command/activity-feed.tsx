"use client";

import { memo, useEffect, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { formatRelativeTime } from "@/lib/utils";

export interface ActivityEvent {
  id: string;
  summary: string;
  emoji: string;
  importance: string;
  createdAt: string;
  monitor: { name: string; url: string };
}

export const ActivityFeed = memo(function ActivityFeed({ events }: { events: ActivityEvent[] }) {
  const [visible, setVisible] = useState(events);

  useEffect(() => {
    setVisible(events);
  }, [events]);

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-4">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-cyan-500/70">
            Live Feed
          </p>
          <h3 className="mt-1 text-sm font-medium text-zinc-200">Activity Timeline</h3>
        </div>
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-cyan-400 opacity-50" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-cyan-400" />
        </span>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {visible.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <p className="text-sm text-zinc-600">No activity yet</p>
            <p className="mt-1 text-xs text-zinc-700">Changes will appear here in real time</p>
          </div>
        ) : (
          <div className="relative space-y-0">
            <div className="absolute bottom-4 left-[11px] top-4 w-px bg-gradient-to-b from-cyan-500/40 via-cyan-500/10 to-transparent" />

            <AnimatePresence initial={false}>
              {visible.map((event, i) => (
                <motion.div
                  key={event.id}
                  initial={{ opacity: 0, x: 24 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05, type: "spring", stiffness: 300, damping: 28 }}
                >
                  <Link
                    href={`/dashboard/changes/${event.id}`}
                    className="group relative flex gap-4 rounded-xl py-3 pl-0 pr-2 transition-colors hover:bg-white/[0.02]"
                  >
                    <div className="relative z-10 mt-1 flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full border border-cyan-400/30 bg-[#090909]">
                      <span className="text-[10px]">{event.emoji}</span>
                    </div>

                    <div className="min-w-0 flex-1 border-b border-white/[0.04] pb-4 group-last:border-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className="truncate text-sm font-medium text-zinc-200 group-hover:text-cyan-100">
                          {event.monitor.name}
                        </p>
                        <span className="shrink-0 font-mono text-[10px] text-zinc-600">
                          {formatRelativeTime(event.createdAt)}
                        </span>
                      </div>
                      <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-zinc-500 group-hover:text-zinc-400">
                        {event.summary}
                      </p>
                      {event.importance === "HIGH" || event.importance === "CRITICAL" ? (
                        <span className="mt-2 inline-block rounded-full border border-amber-400/20 bg-amber-500/10 px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider text-amber-300/80">
                          {event.importance}
                        </span>
                      ) : null}
                    </div>
                  </Link>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
});
