"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Plus } from "lucide-react";
import { CreateMonitorDialog } from "@/components/dashboard/create-monitor-dialog";

export function CreateMonitorFab({
  onCreated,
}: {
  onCreated?: (monitorId: string) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <motion.button
        type="button"
        onClick={() => setOpen(true)}
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        whileHover={{ scale: 1.08 }}
        whileTap={{ scale: 0.95 }}
        className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full border border-cyan-400/40 bg-cyan-500 text-black shadow-[0_0_40px_-6px_rgba(34,211,238,0.7)] lg:bottom-8 lg:right-8"
        aria-label="Create monitor"
      >
        <motion.span
          className="absolute inset-0 rounded-full border border-cyan-400/50"
          animate={{ scale: [1, 1.25, 1], opacity: [0.6, 0, 0.6] }}
          transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
        />
        <Plus className="relative h-6 w-6" />
      </motion.button>

      <CreateMonitorDialog
        open={open}
        onOpenChange={setOpen}
        hideTrigger
        onCreated={(id) => {
          onCreated?.(id);
          setOpen(false);
        }}
        variant="os"
      />
    </>
  );
}
