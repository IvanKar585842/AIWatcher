"use client";

import Link from "next/link";
import { Lock } from "lucide-react";
import type { MonitoringInterval, Plan } from "@prisma/client";
import { SelectItem } from "@/components/ui/select";
import {
  INTERVAL_LABELS,
  INTERVAL_ORDER,
  isIntervalAllowed,
} from "@/lib/constants";
import { cn } from "@/lib/utils";

/** Plan needed to unlock an interval the current plan cannot use. */
export function intervalUpgradePlan(
  plan: Plan,
  interval: MonitoringInterval
): "PRO" | "BUSINESS" | null {
  if (isIntervalAllowed(plan, interval)) return null;
  if (isIntervalAllowed("PRO", interval)) return "PRO";
  return "BUSINESS";
}

export function IntervalSelectItems({
  plan,
  showAll = true,
}: {
  plan: Plan;
  /** When true, list every interval (locked ones stay visible). */
  showAll?: boolean;
}) {
  const intervals = showAll
    ? INTERVAL_ORDER
    : INTERVAL_ORDER.filter((i) => isIntervalAllowed(plan, i));

  return (
    <>
      {intervals.map((interval) => {
        const allowed = isIntervalAllowed(plan, interval);
        const upgrade = intervalUpgradePlan(plan, interval);
        return (
          <SelectItem
            key={interval}
            value={interval}
            disabled={!allowed}
            className={cn(!allowed && "opacity-55")}
            textValue={INTERVAL_LABELS[interval]}
          >
            <span className="flex w-full items-center justify-between gap-3 pr-1">
              <span className={cn("truncate", !allowed && "text-zinc-500")}>
                {INTERVAL_LABELS[interval]}
              </span>
              {!allowed && (
                <span className="inline-flex shrink-0 items-center gap-1 rounded border border-cyan-400/25 bg-cyan-500/10 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-cyan-300/90">
                  <Lock className="h-2.5 w-2.5" />
                  {upgrade === "BUSINESS" ? "Business" : "Premium"}
                </span>
              )}
            </span>
          </SelectItem>
        );
      })}
    </>
  );
}

export function IntervalUpgradeHint({ plan }: { plan: Plan }) {
  const hasLocked = INTERVAL_ORDER.some((i) => !isIntervalAllowed(plan, i));
  if (!hasLocked) return null;
  return (
    <p className="mt-1.5 text-[11px] leading-snug text-zinc-500">
      Faster intervals need an upgrade.{" "}
      <Link
        href="/dashboard/billing"
        className="text-cyan-400/90 underline-offset-2 hover:text-cyan-300 hover:underline"
      >
        Upgrade required
      </Link>
    </p>
  );
}
