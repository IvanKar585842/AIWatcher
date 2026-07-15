"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  RecentActivityPanel,
  type ActivityChange,
  type ActivityNotification,
} from "./recent-activity-panel";
import { cn } from "@/lib/utils";

const DetectionAssistantPanel = dynamic(
  () => import("./detection-assistant-panel").then((m) => m.DetectionAssistantPanel),
  {
    ssr: false,
    loading: () => (
      <div className="flex min-h-[280px] items-center justify-center p-6 text-xs text-zinc-600">
        Loading assistant…
      </div>
    ),
  }
);

type CenterTab = "assistant" | "feed";

export function IntelligenceCenter({
  changes,
  notifications,
}: {
  changes: ActivityChange[];
  notifications: ActivityNotification[];
}) {
  const [tab, setTab] = useState<CenterTab>("feed");
  /** Mount chat only when user opens the assistant tab */
  const [assistantReady, setAssistantReady] = useState(false);

  useEffect(() => {
    // Only prewarm assistant after idle if user stays on feed
    let cancelled = false;
    const enable = () => {
      if (!cancelled && tab === "assistant") setAssistantReady(true);
    };

    let idleId: number | undefined;
    if (typeof window !== "undefined" && "requestIdleCallback" in window) {
      idleId = window.requestIdleCallback(enable, { timeout: 4000 });
    }
    const timer = window.setTimeout(enable, 2000);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      if (idleId !== undefined && "cancelIdleCallback" in window) {
        window.cancelIdleCallback(idleId);
      }
    };
  }, [tab]);

  const tabs: {
    id: CenterTab;
    label: string;
    mobileLabel: string;
    emoji: string;
  }[] = [
    {
      id: "feed",
      label: "Intelligence Feed",
      mobileLabel: "Feed",
      emoji: "🧠",
    },
    {
      id: "assistant",
      label: "Detection Assistant",
      mobileLabel: "Assistant",
      emoji: "🤖",
    },
  ];

  return (
    <section
      className="flex h-full min-h-[360px] w-full min-w-0 max-h-[min(640px,72vh)] flex-col overflow-hidden rounded-2xl border border-cyan-500/15 bg-white/[0.02] lg:max-h-[640px]"
      data-tour="intelligence-center"
    >
      <div className="shrink-0 border-b border-white/[0.06] px-3 pt-3 sm:px-5 sm:pt-5">
        <div className="mb-3 min-w-0 sm:mb-4">
          <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-cyan-500/70">
            WatchFlowing Intelligence Center
          </p>
          <h3 className="mt-1 text-base font-medium text-zinc-100 sm:text-lg">
            Ask AI · Read insights
          </h3>
          <p className="mt-0.5 hidden text-xs text-zinc-500 sm:block">
            Your business monitoring assistant and live change feed — in one place
          </p>
        </div>

        <div
          role="tablist"
          aria-label="Intelligence Center tabs"
          className="mb-3 grid grid-cols-2 gap-1.5 rounded-2xl border border-white/[0.06] bg-black/40 p-1.5 sm:mb-4"
        >
          {tabs.map((t) => {
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={active}
                data-tour={t.id === "feed" ? "tab-feed" : "tab-assistant"}
                onClick={() => {
                  setTab(t.id);
                  if (t.id === "assistant") setAssistantReady(true);
                }}
                className={cn(
                  "relative flex min-h-12 items-center justify-center gap-2 rounded-xl px-2 py-2.5 text-sm font-medium transition-colors sm:min-h-[3.25rem] sm:px-4",
                  active ? "text-cyan-50" : "text-zinc-500 hover:text-zinc-300"
                )}
              >
                {active && (
                  <motion.div
                    layoutId="intelligence-center-tab"
                    className="absolute inset-0 rounded-xl border border-cyan-400/30 bg-cyan-500/15 shadow-[0_0_24px_-8px_rgba(34,211,238,0.45)]"
                    transition={{ type: "spring", stiffness: 420, damping: 32 }}
                  />
                )}
                <span className="relative shrink-0 text-base leading-none" aria-hidden>
                  {t.emoji}
                </span>
                <span className="relative truncate sm:hidden">{t.mobileLabel}</span>
                <span className="relative hidden truncate sm:inline">{t.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="relative min-h-0 w-full min-w-0 flex-1 overflow-hidden">
        <AnimatePresence mode="wait" initial={false}>
          {tab === "feed" ? (
            <motion.div
              key="feed"
              role="tabpanel"
              data-tour="intelligence-feed"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
              className="flex h-full min-h-0 w-full flex-col"
            >
              <RecentActivityPanel
                embedded
                changes={changes}
                notifications={notifications}
              />
            </motion.div>
          ) : (
            <motion.div
              key="assistant"
              role="tabpanel"
              data-tour="detection-assistant"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
              className="flex h-full min-h-0 w-full flex-col overflow-hidden"
            >
              {assistantReady ? (
                <DetectionAssistantPanel embedded />
              ) : (
                <div className="flex min-h-[280px] flex-1 items-center justify-center p-6 text-xs text-zinc-600">
                  Loading assistant…
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </section>
  );
}
