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
      className="space-y-6 p-4 lg:p-6"
    >
      <div className="flex items-end justify-between gap-4">
        <div className="space-y-2">
          <ShimmerBlock className="h-3 w-32" />
          <ShimmerBlock className="h-6 w-48" />
        </div>
        <ShimmerBlock className="h-9 w-28 rounded-full" />
      </div>
      <QuickActionsSkeleton />
      <StatReadoutsSkeleton />
      <MonitoringHealthSkeleton />
      <div className="grid gap-4 lg:grid-cols-[1fr_380px]">
        <ShimmerBlock className="min-h-[420px] border border-white/[0.04]" />
        <ShimmerBlock className="min-h-[420px] border border-white/[0.04]" />
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
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: "spring", stiffness: 300, damping: 28 }}
      className="flex flex-col items-center justify-center px-6 py-12 text-center"
    >
      <motion.div
        animate={{ y: [0, -4, 0] }}
        transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
        className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-cyan-400/20 bg-gradient-to-br from-cyan-500/[0.08] to-violet-500/[0.04]"
      >
        <Icon className="h-6 w-6 text-cyan-400/70" />
      </motion.div>
      <p className="text-sm font-medium text-zinc-300">{title}</p>
      <p className="mt-1.5 max-w-xs text-xs leading-relaxed text-zinc-600">{description}</p>
      {action && <div className="mt-5">{action}</div>}
    </motion.div>
  );
}
