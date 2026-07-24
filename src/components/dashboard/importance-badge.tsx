"use client";

import {
  AlertOctagon,
  AlertTriangle,
  CircleDot,
  Info,
  type LucideIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { importanceLabel, type ImportanceLevel } from "@/lib/importance";
import { cn } from "@/lib/utils";

const META: Record<
  ImportanceLevel,
  {
    Icon: LucideIcon;
    badgeClass: string;
    chipClass: string;
    dotClass: string;
  }
> = {
  CRITICAL: {
    Icon: AlertOctagon,
    badgeClass:
      "border-red-500/40 bg-red-500/15 text-red-200 shadow-[0_0_12px_rgba(239,68,68,0.25)]",
    chipClass: "border-red-400/30 bg-red-500/10 text-red-300",
    dotClass: "border-red-400 bg-red-500 shadow-[0_0_12px_rgba(248,113,113,0.55)]",
  },
  HIGH: {
    Icon: AlertTriangle,
    badgeClass:
      "border-amber-400/40 bg-amber-500/15 text-amber-100 shadow-[0_0_10px_rgba(251,191,36,0.2)]",
    chipClass: "border-amber-400/30 bg-amber-500/10 text-amber-300",
    dotClass: "border-amber-300 bg-amber-400 shadow-[0_0_10px_rgba(251,191,36,0.5)]",
  },
  MEDIUM: {
    Icon: CircleDot,
    badgeClass: "border-cyan-400/35 bg-cyan-500/12 text-cyan-100",
    chipClass: "border-cyan-400/20 bg-cyan-500/10 text-cyan-300",
    dotClass: "border-cyan-300 bg-cyan-400 shadow-[0_0_10px_rgba(34,211,238,0.45)]",
  },
  LOW: {
    Icon: Info,
    badgeClass: "border-zinc-500/30 bg-zinc-500/10 text-zinc-400",
    chipClass: "border-white/10 bg-white/[0.04] text-zinc-500",
    dotClass: "border-white/20 bg-zinc-600",
  },
};

function resolveLevel(importance: string): ImportanceLevel {
  const key = String(importance).toUpperCase();
  if (key === "CRITICAL" || key === "HIGH" || key === "MEDIUM" || key === "LOW") {
    return key;
  }
  return "MEDIUM";
}

export function importanceChipClass(importance: string): string {
  return META[resolveLevel(importance)].chipClass;
}

export function importanceDotClass(importance: string): string {
  return META[resolveLevel(importance)].dotClass;
}

export function ImportanceBadge({
  importance,
  className,
  size = "md",
}: {
  importance: string;
  className?: string;
  size?: "sm" | "md";
}) {
  const level = resolveLevel(importance);
  const { Icon, badgeClass } = META[level];
  const iconSize = size === "sm" ? "h-3 w-3" : "h-3.5 w-3.5";

  return (
    <Badge
      variant="outline"
      className={cn(
        "inline-flex items-center gap-1 font-medium tracking-wide",
        size === "sm" ? "px-1.5 py-0 text-[10px]" : "px-2 py-0.5 text-xs",
        badgeClass,
        className
      )}
    >
      <Icon className={iconSize} aria-hidden />
      <span>{importanceLabel(level)}</span>
    </Badge>
  );
}
