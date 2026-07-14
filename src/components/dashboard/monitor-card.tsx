"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import {
  Copy,
  ExternalLink,
  Pause,
  Play,
  Settings,
  Trash2,
} from "lucide-react";
import { MODE_LABELS } from "@/lib/constants";
import {
  formatRelativeTime,
  formatUpcomingTime,
  getDomainFromUrl,
} from "@/lib/utils";
import type { Monitor } from "@prisma/client";
import { MonitorErrorBanner } from "@/components/dashboard/monitor-error-banner";
import { WebsiteLogo } from "@/components/dashboard/website-logo";

interface MonitorWithCount extends Monitor {
  _count: { changes: number };
}

interface MonitorCardProps {
  monitor: MonitorWithCount;
  index: number;
  onPause: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
}

function getAiConfidence(monitor: MonitorWithCount): number {
  if (monitor.status === "ERROR") return Math.max(15, 100 - monitor.errorCount * 30);
  if (!monitor.lastCheckedAt) return 0;
  if (monitor.errorCount > 0) return Math.max(35, 90 - monitor.errorCount * 20);
  return Math.min(99, 88 + Math.min(monitor._count.changes, 3) * 3);
}

const STATUS_STYLES = {
  ACTIVE: {
    label: "Active",
    dot: "bg-emerald-400",
    ring: "border-emerald-500/30",
    glow: "shadow-[0_0_24px_-6px_rgba(52,211,153,0.35)]",
    pulse: true,
  },
  PAUSED: {
    label: "Paused",
    dot: "bg-amber-400",
    ring: "border-amber-500/25",
    glow: "",
    pulse: false,
  },
  ERROR: {
    label: "Error",
    dot: "bg-red-400",
    ring: "border-red-500/30",
    glow: "shadow-[0_0_24px_-6px_rgba(248,113,113,0.3)]",
    pulse: true,
  },
} as const;

function ActionButton({
  label,
  onClick,
  href,
  danger,
  children,
}: {
  label: string;
  onClick?: () => void;
  href?: string;
  danger?: boolean;
  children: React.ReactNode;
}) {
  const className = `group/btn flex min-h-11 min-w-[3.25rem] flex-col items-center justify-center gap-0.5 rounded-lg px-1.5 py-1.5 text-zinc-500 transition-colors hover:bg-white/[0.04] hover:text-cyan-300 active:bg-white/[0.06] ${
    danger ? "hover:!text-red-400" : ""
  }`;

  const inner = (
    <>
      <span className="flex h-9 w-9 items-center justify-center rounded-md border border-white/[0.06] bg-[#090909] transition-colors group-hover/btn:border-cyan-400/20">
        {children}
      </span>
      <span className="font-mono text-[9px] uppercase tracking-wider text-zinc-600 opacity-100 sm:opacity-70 sm:group-hover/btn:opacity-100">
        {label}
      </span>
    </>
  );

  if (href) {
    const innerContent = inner;
    if (href.startsWith("/")) {
      return (
        <Link href={href} className={className} title={label} aria-label={label}>
          {innerContent}
        </Link>
      );
    }
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={className} title={label} aria-label={label}>
        {innerContent}
      </a>
    );
  }

  return (
    <button type="button" onClick={onClick} className={className} title={label} aria-label={label}>
      {inner}
    </button>
  );
}

export function MonitorCard({
  monitor,
  index,
  onPause,
  onDelete,
  onDuplicate,
}: MonitorCardProps) {
  const status = STATUS_STYLES[monitor.status as keyof typeof STATUS_STYLES] ?? STATUS_STYLES.PAUSED;
  const confidence = getAiConfidence(monitor);
  const domain = getDomainFromUrl(monitor.url);

  return (
    <motion.article
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06, type: "spring", stiffness: 280, damping: 26 }}
      whileHover={{ y: -6, scale: 1.015 }}
      className={`group relative overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.02] transition-shadow duration-500 hover:border-cyan-400/20 hover:bg-white/[0.03] hover:shadow-[0_0_40px_-12px_rgba(34,211,238,0.25)] ${status.glow}`}
    >
      <div className="pointer-events-none absolute -right-12 -top-12 h-32 w-32 rounded-full bg-cyan-500/[0.04] blur-2xl transition-opacity group-hover:opacity-100 opacity-0" />

      <div className="relative p-5">
        {/* Header */}
        <div className="flex items-start gap-3">
          <div className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/[0.08] bg-[#090909]">
            <WebsiteLogo
              url={monitor.url}
              faviconUrl={monitor.faviconUrl}
              size={24}
              alt=""
            />
            {status.pulse && (
              <span className="absolute -right-0.5 -top-0.5 flex h-2.5 w-2.5">
                <span
                  className={`absolute inline-flex h-full w-full animate-ping rounded-full ${status.dot} opacity-60`}
                />
                <span className={`relative inline-flex h-2.5 w-2.5 rounded-full ${status.dot}`} />
              </span>
            )}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <Link
                href={`/dashboard/monitors/${monitor.id}`}
                className="truncate text-sm font-medium text-zinc-100 transition-colors hover:text-cyan-200"
              >
                {monitor.name}
              </Link>
              <span
                className={`shrink-0 rounded-full border px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider ${status.ring} text-zinc-400`}
              >
                {status.label}
              </span>
            </div>
            <p className="mt-0.5 truncate font-mono text-[11px] text-zinc-600">{monitor.url}</p>
            <p className="mt-1 font-mono text-[10px] text-zinc-700">{domain}</p>
          </div>
        </div>

        {/* Mode badge */}
        <div className="mt-4 inline-flex rounded-full border border-cyan-500/15 bg-cyan-500/[0.06] px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider text-cyan-400/80">
          {MODE_LABELS[monitor.mode]}
        </div>

        {/* Metrics grid */}
        <div className="mt-4 grid grid-cols-2 gap-3">
          <MetricCell label="Last check" value={monitor.lastCheckedAt ? formatRelativeTime(monitor.lastCheckedAt) : "—"} />
          <MetricCell label="Next check" value={formatUpcomingTime(monitor.nextCheckAt)} />
          <MetricCell label="AI confidence" value={`${confidence}%`} accent />
          <MetricCell
            label="Last change"
            value={monitor.lastChangedAt ? formatRelativeTime(monitor.lastChangedAt) : "None yet"}
          />
        </div>

        {monitor.errorMessage && (
          <MonitorErrorBanner errorMessage={monitor.errorMessage} compact />
        )}

        {/* Actions */}
        <div className="mt-5 flex flex-wrap items-center justify-between gap-2 border-t border-white/[0.06] pt-4">
          <div className="flex flex-wrap items-center gap-0.5">
            <ActionButton
              label={monitor.status === "ACTIVE" ? "Pause" : "Resume"}
              onClick={onPause}
            >
              {monitor.status === "ACTIVE" ? (
                <Pause className="h-3.5 w-3.5" />
              ) : (
                <Play className="h-3.5 w-3.5" />
              )}
            </ActionButton>
            <ActionButton label="Settings" href={`/dashboard/monitors/${monitor.id}`}>
              <Settings className="h-3.5 w-3.5" />
            </ActionButton>
            <ActionButton label="Duplicate" onClick={onDuplicate}>
              <Copy className="h-3.5 w-3.5" />
            </ActionButton>
            <ActionButton label="Delete" onClick={onDelete} danger>
              <Trash2 className="h-3.5 w-3.5" />
            </ActionButton>
          </div>
          <ActionButton label="Open" href={monitor.url}>
            <ExternalLink className="h-3.5 w-3.5" />
          </ActionButton>
        </div>
      </div>
    </motion.article>
  );
}

function MetricCell({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="rounded-lg border border-white/[0.04] bg-[#090909]/60 px-3 py-2">
      <p className="font-mono text-[9px] uppercase tracking-wider text-zinc-700">{label}</p>
      <p
        className={`mt-0.5 truncate text-xs tabular-nums ${
          accent ? "text-cyan-300/90" : "text-zinc-400"
        }`}
      >
        {value}
      </p>
    </div>
  );
}

export type { MonitorWithCount };
