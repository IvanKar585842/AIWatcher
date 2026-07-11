"use client";

import { motion } from "framer-motion";
import { History, Radar } from "lucide-react";

export function HistoryEmptyState({ filtered }: { filtered?: boolean }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 260, damping: 28 }}
      className="relative overflow-hidden rounded-2xl border border-dashed border-cyan-500/20 bg-gradient-to-br from-cyan-500/[0.04] via-transparent to-blue-500/[0.03] px-6 py-16 text-center sm:py-20"
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(34,211,238,0.08),transparent_70%)]" />

      <motion.div
        animate={{ y: [0, -8, 0], rotate: [0, 2, -2, 0] }}
        transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
        className="relative mx-auto mb-6 flex h-24 w-24 items-center justify-center rounded-2xl border border-cyan-400/25 bg-cyan-500/10 shadow-[0_0_48px_-10px_rgba(34,211,238,0.55)]"
      >
        {filtered ? (
          <History className="h-10 w-10 text-cyan-400/90" />
        ) : (
          <Radar className="h-10 w-10 text-cyan-400/90" />
        )}
        <motion.span
          className="absolute inset-0 rounded-2xl border border-cyan-400/20"
          animate={{ scale: [1, 1.08, 1], opacity: [0.5, 0, 0.5] }}
          transition={{ duration: 2.5, repeat: Infinity }}
        />
      </motion.div>

      <h3 className="relative text-xl font-semibold text-zinc-100">
        {filtered ? "No matching changes" : "No changes detected yet"}
      </h3>
      <p className="relative mx-auto mt-2 max-w-md text-sm leading-relaxed text-zinc-500">
        {filtered
          ? "Try adjusting your search or filters to find what you're looking for."
          : "Your monitor is active and watching your website. When something meaningful changes, it will show up here with an AI summary."}
      </p>
    </motion.div>
  );
}
