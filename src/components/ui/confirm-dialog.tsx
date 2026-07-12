"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  tone = "default",
  loading = false,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: "default" | "danger";
  loading?: boolean;
  onConfirm: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-white/[0.08] bg-[#0c0c0c] text-zinc-100 sm:max-w-md">
        <DialogHeader className="space-y-2 text-left">
          <DialogTitle className="text-lg text-zinc-50">{title}</DialogTitle>
          <DialogDescription className="text-sm leading-relaxed text-zinc-500">
            {description}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="mt-2 gap-2 sm:gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={loading}
            onClick={() => onOpenChange(false)}
            className="min-h-11 rounded-full border-white/[0.1] bg-transparent text-zinc-300 hover:bg-white/[0.04] hover:text-zinc-100"
          >
            {cancelLabel}
          </Button>
          <Button
            type="button"
            disabled={loading}
            onClick={onConfirm}
            className={cn(
              "min-h-11 rounded-full",
              tone === "danger"
                ? "border border-red-400/30 bg-red-500/20 text-red-100 hover:bg-red-500/30"
                : "border border-cyan-400/30 bg-cyan-500/20 text-cyan-50 hover:bg-cyan-500/30"
            )}
          >
            {loading ? "Please wait…" : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
