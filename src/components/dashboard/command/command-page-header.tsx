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
      className="mb-6 flex flex-col gap-4 sm:mb-8 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between"
    >
      <div className="min-w-0">
        {label && (
          <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-cyan-500/60">
            {label}
          </p>
        )}
        <h1 className="mt-1 text-xl font-semibold text-zinc-100">{title}</h1>
        {description && (
          <p className="mt-1 text-sm text-zinc-500">{description}</p>
        )}
      </div>
      {children && <div className="w-full sm:w-auto sm:shrink-0 [&_button]:w-full sm:[&_button]:w-auto">{children}</div>}
    </motion.div>
  );
}
