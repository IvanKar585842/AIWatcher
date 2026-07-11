"use client";

import { motion } from "framer-motion";

function ShimmerBlock({ className }: { className?: string }) {
  return (
    <div className={`relative overflow-hidden rounded-2xl bg-white/[0.03] ${className ?? ""}`}>
      <div className="absolute inset-0 -translate-x-full animate-[shimmer_2s_infinite] bg-gradient-to-r from-transparent via-white/[0.07] to-transparent" />
    </div>
  );
}

export function StatReadoutsSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
      {Array.from({ length: 5 }).map((_, i) => (
        <ShimmerBlock key={i} className="h-28 border border-white/[0.04]" />
      ))}
    </div>
  );
}

export function MonitoringHealthSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <ShimmerBlock key={i} className="h-24 border border-white/[0.04]" />
      ))}
    </div>
  );
}

export function QuickActionsSkeleton() {
  return <ShimmerBlock className="h-14 border border-white/[0.04]" />;
}

export function CommandCenterSkeleton() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-3 p-3 sm:space-y-4 sm:p-4 lg:space-y-6 lg:p-6"
    >
      <div className="flex items-end justify-between gap-4">
        <div className="space-y-2">
          <ShimmerBlock className="h-3 w-32" />
          <ShimmerBlock className="h-6 w-48" />
        </div>
        <ShimmerBlock className="hidden h-9 w-28 rounded-full lg:block" />
      </div>
      <ShimmerBlock className="h-[min(520px,62dvh)] min-h-[420px] border border-white/[0.04]" />
      <div className="grid grid-cols-3 gap-2 lg:hidden">
        {Array.from({ length: 3 }).map((_, i) => (
          <ShimmerBlock key={i} className="h-24 border border-white/[0.04]" />
        ))}
      </div>
      <ShimmerBlock className="min-h-[320px] border border-white/[0.04] lg:min-h-[560px]" />
      <div className="hidden space-y-4 lg:block">
        <StatReadoutsSkeleton />
        <MonitoringHealthSkeleton />
      </div>
    </motion.div>
  );
}

export function MonitorGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: count }).map((_, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.06 }}
        >
          <div className="overflow-hidden rounded-2xl border border-white/[0.04] bg-white/[0.02]">
            <ShimmerBlock className="h-48 rounded-none" />
            <div className="space-y-3 p-4">
              <ShimmerBlock className="h-4 w-3/4" />
              <ShimmerBlock className="h-3 w-1/2" />
              <div className="flex gap-2 pt-2">
                <ShimmerBlock className="h-8 w-16 rounded-lg" />
                <ShimmerBlock className="h-8 w-16 rounded-lg" />
                <ShimmerBlock className="h-8 w-16 rounded-lg" />
              </div>
            </div>
          </div>
        </motion.div>
      ))}
    </div>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: React.ElementType;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      className="flex flex-col items-center justify-center px-6 py-12 text-center"
    >
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-cyan-400/20 bg-cyan-500/[0.08]">
        <Icon className="h-6 w-6 text-cyan-400/80" />
      </div>
      <p className="text-sm font-medium text-zinc-200">{title}</p>
      <p className="mt-2 max-w-sm text-xs leading-relaxed text-zinc-500">{description}</p>
      {action && <div className="mt-5">{action}</div>}
    </motion.div>
  );
}
