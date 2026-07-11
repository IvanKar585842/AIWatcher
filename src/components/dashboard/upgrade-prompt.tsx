"use client";

import Link from "next/link";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function UpgradePrompt({
  title,
  description,
  className,
  cta = "Upgrade to Pro",
}: {
  title: string;
  description: string;
  className?: string;
  cta?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border border-cyan-500/20 bg-gradient-to-br from-cyan-500/[0.08] via-transparent to-violet-500/[0.05] p-4 sm:p-5",
        className
      )}
    >
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-cyan-400/25 bg-cyan-500/10 text-cyan-300">
          <Sparkles className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-zinc-100">{title}</p>
          <p className="mt-1 text-xs leading-relaxed text-zinc-500">{description}</p>
          <Button
            asChild
            size="sm"
            className="mt-3 rounded-full bg-cyan-500 text-black hover:bg-cyan-400"
          >
            <Link href="/dashboard/billing">{cta}</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
