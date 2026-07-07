"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Download, Pause, Play, Loader2 } from "lucide-react";

interface QuickActionsProps {
  onRefresh: () => void;
  pausedCount: number;
  activeCount: number;
}

export function QuickActions({ onRefresh, pausedCount, activeCount }: QuickActionsProps) {
  const [loading, setLoading] = useState<string | null>(null);

  function notifyMonitorsUpdated() {
    window.dispatchEvent(new CustomEvent("monitors-updated"));
  }

  async function runBulk(action: "pause_all" | "resume_all" | "export") {
    setLoading(action);
    try {
      const res = await fetch("/api/monitors/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();

      if (!res.ok) return;

      if (action === "export") {
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `watchflow-monitors-${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
        URL.revokeObjectURL(url);
      } else {
        onRefresh();
        notifyMonitorsUpdated();
      }
    } finally {
      setLoading(null);
    }
  }

  const actions = [
    {
      id: "pause_all",
      label: "Pause All",
      icon: Pause,
      onClick: () => runBulk("pause_all"),
      disabled: activeCount === 0,
    },
    {
      id: "resume_all",
      label: "Resume All",
      icon: Play,
      onClick: () => runBulk("resume_all"),
      disabled: pausedCount === 0,
    },
    {
      id: "export",
      label: "Export",
      icon: Download,
      onClick: () => runBulk("export"),
      disabled: false,
    },
  ] as const;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.05 }}
      className="flex flex-wrap gap-2"
    >
      {actions.map((action, i) => {
        const Icon = action.icon;
        const isLoading = loading === action.id;
        return (
          <motion.button
            key={action.id}
            type="button"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.08 + i * 0.04 }}
            whileHover={{ scale: action.disabled ? 1 : 1.02 }}
            whileTap={{ scale: action.disabled ? 1 : 0.98 }}
            onClick={action.onClick}
            disabled={action.disabled || isLoading}
            className="inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.03] px-4 py-2 text-xs font-medium text-zinc-400 transition-all hover:border-white/[0.14] hover:bg-white/[0.05] hover:text-zinc-200 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {isLoading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Icon className="h-3.5 w-3.5" />
            )}
            {action.label}
          </motion.button>
        );
      })}
    </motion.div>
  );
}
