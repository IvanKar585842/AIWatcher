"use client";

import { motion } from "framer-motion";
import { Activity, Bot, LineChart, Search } from "lucide-react";
import { CreateMonitorDialog } from "@/components/dashboard/create-monitor-dialog";

const EXAMPLES = [
  { icon: Activity, label: "Website Health" },
  { icon: Search, label: "Competitor Monitoring" },
  { icon: LineChart, label: "SEO Monitoring" },
  { icon: Bot, label: "AI Smart Monitoring" },
] as const;

export function MonitorsEmptyState({
  onCreated,
  showCreateButton = true,
  variant = "dashboard",
}: {
  onCreated?: (monitorId: string) => void;
  showCreateButton?: boolean;
  variant?: "dashboard" | "monitors";
}) {
  const title = variant === "monitors" ? "No monitors created yet" : "No monitors yet";
  const description =
    variant === "monitors"
      ? "Create your first monitor and let WatchFlowing protect what matters on your site."
      : "Create your first monitor to start tracking important changes with WatchFlowing AI.";
  const buttonLabel = variant === "monitors" ? "+ Create Monitor" : "Create Monitor";

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 260, damping: 28 }}
      className="relative overflow-hidden rounded-2xl border border-dashed border-cyan-500/20 bg-gradient-to-br from-cyan-500/[0.04] via-transparent to-blue-500/[0.03] px-5 py-12 text-center sm:px-8 sm:py-16"
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(34,211,238,0.08),transparent_70%)]" />

      <motion.div
        animate={{ y: [0, -8, 0] }}
        transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
        className="relative mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-2xl border border-cyan-400/25 bg-cyan-500/10 shadow-[0_0_48px_-10px_rgba(34,211,238,0.55)]"
      >
        <Activity className="h-9 w-9 text-cyan-400/90" />
      </motion.div>

      <h3 className="relative text-xl font-semibold tracking-tight text-zinc-100">{title}</h3>
      <p className="relative mx-auto mt-2 max-w-md text-sm leading-relaxed text-zinc-500">
        {description}
      </p>

      {showCreateButton && (
        <motion.div
          className="relative mt-8"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          <CreateMonitorDialog
            onCreated={onCreated}
            variant="os"
            triggerLabel={buttonLabel}
            triggerClassName="h-12 px-8 text-sm font-medium shadow-[0_0_40px_-8px_rgba(34,211,238,0.65)]"
          />
        </motion.div>
      )}

      <div className="relative mx-auto mt-10 max-w-lg">
        <p className="mb-3 font-mono text-[10px] uppercase tracking-[0.2em] text-zinc-600">
          Popular monitoring types
        </p>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {EXAMPLES.map(({ icon: Icon, label }) => (
            <div
              key={label}
              className="flex items-center gap-2.5 rounded-xl border border-white/[0.06] bg-black/25 px-3.5 py-3 text-left"
            >
              <Icon className="h-4 w-4 shrink-0 text-cyan-400/70" />
              <span className="text-xs text-zinc-400">{label}</span>
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}
