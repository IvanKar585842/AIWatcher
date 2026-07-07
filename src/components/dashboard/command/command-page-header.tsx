"use client";

import { motion } from "framer-motion";

export function CommandPageHeader({
  label,
  title,
  description,
  children,
}: {
  label?: string;
  title: string;
  description?: string;
  children?: React.ReactNode;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="mb-8 flex flex-wrap items-end justify-between gap-4"
    >
      <div>
        {label && (
          <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-cyan-500/60">
            {label}
          </p>
        )}
        <h1 className="mt-1 text-xl font-semibold text-zinc-100">{title}</h1>
        {description && (
          <p className="mt-1 text-sm text-zinc-600">{description}</p>
        )}
      </div>
      {children}
    </motion.div>
  );
}
