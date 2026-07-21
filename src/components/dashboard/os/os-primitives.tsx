"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export const os = {
  page: "w-full max-w-full overflow-x-hidden p-3 sm:p-4 lg:p-6",
  card: "rounded-2xl border border-white/[0.06] bg-white/[0.02] backdrop-blur-sm",
  cardHover: "transition-all hover:border-cyan-500/20 hover:bg-white/[0.03]",
  glow: "shadow-[0_0_40px_-12px_rgba(34,211,238,0.25)]",
  label: "font-mono text-[10px] uppercase tracking-widest text-cyan-500/70",
  title: "text-xl font-semibold text-zinc-100",
  subtitle: "text-sm text-zinc-500",
  input:
    "border-white/[0.08] bg-black/50 text-zinc-100 placeholder:text-zinc-600 focus-visible:ring-cyan-500/40",
  btnPrimary:
    "rounded-full border border-cyan-400/30 bg-cyan-500/15 text-cyan-100 shadow-[0_0_32px_-8px_rgba(34,211,238,0.5)] hover:border-cyan-300/50 hover:bg-cyan-500/25",
};

export function OsFieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <Label className="mb-1.5 block font-mono text-[10px] uppercase tracking-widest text-zinc-500">
      {children}
    </Label>
  );
}

export function OsInput(props: React.ComponentProps<typeof Input>) {
  return <Input {...props} className={cn(os.input, props.className)} />;
}

export function OsCard({
  children,
  className,
  glow,
}: {
  children: React.ReactNode;
  className?: string;
  glow?: boolean;
}) {
  return (
    <div className={cn(os.card, glow && os.glow, className)}>{children}</div>
  );
}

export function OsExpandableSection({
  title,
  subtitle,
  icon,
  children,
  defaultOpen = false,
  danger,
  onOpenChange,
}: {
  title: string;
  subtitle?: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  defaultOpen?: boolean;
  danger?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const [open, setOpen] = useState(defaultOpen);

  function toggle() {
    setOpen((prev) => {
      const next = !prev;
      onOpenChange?.(next);
      return next;
    });
  }

  return (
    <OsCard
      className={cn("overflow-hidden", danger && "border-red-500/20")}
    >
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        className="flex w-full min-h-12 items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-white/[0.02] sm:gap-4 sm:px-5 sm:py-4"
      >
        <div
          className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border",
            danger
              ? "border-red-500/30 bg-red-500/10 text-red-400"
              : "border-cyan-500/20 bg-cyan-500/10 text-cyan-400"
          )}
        >
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-medium text-zinc-100">{title}</p>
          {subtitle && <p className="mt-0.5 text-xs text-zinc-500">{subtitle}</p>}
        </div>
        <motion.div animate={{ rotate: open ? 180 : 0 }}>
          <ChevronDown className="h-5 w-5 text-zinc-500" />
        </motion.div>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="border-t border-white/[0.06] px-5 py-4">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </OsCard>
  );
}

export function OsUsageBar({
  label,
  used,
  limit,
  unit = "",
}: {
  label: string;
  used: number;
  limit: number | null;
  unit?: string;
}) {
  const pct =
    limit != null && limit > 0
      ? Math.min(100, Math.round((used / limit) * 100))
      : used > 0
        ? 8
        : 0;
  const display = limit != null ? `${used} / ${limit}${unit}` : `${used}${unit}`;

  return (
    <div>
      <div className="mb-2 flex items-center justify-between text-sm">
        <span className="text-zinc-400">{label}</span>
        <span className="font-mono text-xs text-zinc-500">{display}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-white/[0.06]">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.8, ease: [0.4, 0, 0.2, 1] }}
          className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-blue-500"
        />
      </div>
    </div>
  );
}
