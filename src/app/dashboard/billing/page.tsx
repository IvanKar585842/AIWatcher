"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Check, Crown, ExternalLink, Loader2, Sparkles, Zap } from "lucide-react";
import { CommandPageHeader } from "@/components/dashboard/command/command-page-header";
import { OsCard, OsUsageBar } from "@/components/dashboard/os/os-primitives";
import { Button } from "@/components/ui/button";
import { PRICING_PLANS } from "@/lib/constants";
import { fetchApi } from "@/lib/fetch-api";
import { cn } from "@/lib/utils";

interface BillingOverview {
  plan: "FREE" | "PRO" | "BUSINESS";
  limits: { maxMonitors: number | null; aiSummaries: boolean; telegram: boolean };
  usage: { monitors: number; aiAnalyses: number; notifications: number; storageMb: number };
  storageLimitMb: number | null;
  aiLimit: number | null;
  notificationLimit: number | null;
}

export default function BillingPage() {
  const [loading, setLoading] = useState<string | null>(null);
  const [portalLoading, setPortalLoading] = useState(false);
  const [overview, setOverview] = useState<BillingOverview | null>(null);
  const [overviewLoading, setOverviewLoading] = useState(true);

  useEffect(() => {
    fetchApi<BillingOverview>("/api/billing/overview").then((result) => {
      if (result.success) setOverview(result.data);
      setOverviewLoading(false);
    });
  }, []);

  async function handleUpgrade(plan: "PRO" | "BUSINESS") {
    setLoading(plan);
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
    } finally {
      setLoading(null);
    }
  }

  async function openPortal() {
    setPortalLoading(true);
    try {
      const res = await fetch("/api/billing/checkout");
      const data = await res.json();
      if (data.url) window.location.href = data.url;
    } finally {
      setPortalLoading(false);
    }
  }

  const currentPlan = overview?.plan ?? "FREE";

  return (
    <div className="space-y-8 p-4 lg:p-6">
      <CommandPageHeader
        label="Subscription"
        title="Billing"
        description="Manage your plan, usage, and payment details."
      >
        <Button
          variant="outline"
          onClick={openPortal}
          disabled={portalLoading}
          className="rounded-full border-white/[0.08] bg-white/[0.02] text-zinc-300 hover:border-cyan-500/30 hover:bg-cyan-500/10 hover:text-cyan-100"
        >
          {portalLoading ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <ExternalLink className="mr-2 h-4 w-4" />
          )}
          Billing Portal
        </Button>
      </CommandPageHeader>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="grid gap-4 lg:grid-cols-2"
      >
        <OsCard className="p-6" glow>
          <div className="mb-6 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-cyan-500/30 bg-cyan-500/10">
              <Zap className="h-5 w-5 text-cyan-400" />
            </div>
            <div>
              <p className="font-mono text-[10px] uppercase tracking-widest text-cyan-500/70">
                Usage Overview
              </p>
              <p className="text-sm text-zinc-500">Last 30 days</p>
            </div>
          </div>

          {overviewLoading ? (
            <div className="space-y-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-10 animate-pulse rounded-lg bg-white/[0.04]" />
              ))}
            </div>
          ) : overview ? (
            <div className="space-y-5">
              <OsUsageBar
                label="Monitor usage"
                used={overview.usage.monitors}
                limit={overview.limits.maxMonitors}
              />
              <OsUsageBar
                label="AI analyses"
                used={overview.usage.aiAnalyses}
                limit={overview.aiLimit}
              />
              <OsUsageBar
                label="Notifications sent"
                used={overview.usage.notifications}
                limit={overview.notificationLimit}
              />
              <OsUsageBar
                label="Storage"
                used={overview.usage.storageMb}
                limit={overview.storageLimitMb}
                unit=" MB"
              />
            </div>
          ) : null}
        </OsCard>

        <OsCard className="flex flex-col justify-center p-6">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-violet-500/30 bg-violet-500/10 shadow-[0_0_32px_-10px_rgba(139,92,246,0.5)]">
              <Crown className="h-6 w-6 text-violet-300" />
            </div>
            <div>
              <p className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">
                Current plan
              </p>
              <p className="text-2xl font-semibold text-zinc-100">{currentPlan}</p>
            </div>
          </div>
          <p className="mt-4 text-sm leading-relaxed text-zinc-500">
            {currentPlan === "FREE"
              ? "Upgrade to unlock faster intervals, Telegram alerts, and AI-powered summaries."
              : currentPlan === "PRO"
                ? "You have access to advanced monitoring, AI summaries, and Telegram notifications."
                : "Full enterprise access with unlimited monitors and priority support."}
          </p>
        </OsCard>
      </motion.div>

      <div>
        <p className="mb-4 font-mono text-[10px] uppercase tracking-[0.3em] text-cyan-500/60">
          Plans
        </p>
        <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
          {PRICING_PLANS.map((plan, i) => {
            const isCurrent = plan.plan === currentPlan;
            const isPopular = plan.popular;

            return (
              <motion.div
                key={plan.id}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.08 }}
                whileHover={{ y: -4 }}
                className={cn(
                  "relative flex flex-col rounded-2xl border bg-white/[0.02] p-6 backdrop-blur-sm transition-all",
                  isCurrent
                    ? "border-cyan-400/40 shadow-[0_0_48px_-12px_rgba(34,211,238,0.55)]"
                    : "border-white/[0.06] hover:border-cyan-500/20 hover:shadow-[0_0_32px_-14px_rgba(34,211,238,0.35)]"
                )}
              >
                {isCurrent && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full border border-cyan-400/40 bg-cyan-500/20 px-3 py-0.5 font-mono text-[10px] uppercase tracking-wider text-cyan-200">
                    Current
                  </span>
                )}
                {isPopular && !isCurrent && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 flex items-center gap-1 rounded-full border border-violet-400/40 bg-violet-500/20 px-3 py-0.5 font-mono text-[10px] uppercase tracking-wider text-violet-200">
                    <Sparkles className="h-3 w-3" />
                    Popular
                  </span>
                )}

                <h3 className="text-lg font-semibold text-zinc-100">{plan.name}</h3>
                <p className="mt-1 text-sm text-zinc-500">{plan.description}</p>

                <div className="mt-5">
                  <span className="text-4xl font-bold text-zinc-50">${plan.price}</span>
                  {plan.price > 0 && (
                    <span className="text-sm text-zinc-500">/mo</span>
                  )}
                </div>

                <ul className="mt-6 flex-1 space-y-2.5">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2 text-sm text-zinc-400">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-cyan-400" />
                      {feature}
                    </li>
                  ))}
                </ul>

                {plan.id !== "free" && (
                  <Button
                    className={cn(
                      "mt-6 w-full rounded-full",
                      isCurrent
                        ? "border border-cyan-400/30 bg-cyan-500/10 text-cyan-200 hover:bg-cyan-500/15"
                        : "bg-cyan-500 text-black hover:bg-cyan-400"
                    )}
                    onClick={() => handleUpgrade(plan.plan as "PRO" | "BUSINESS")}
                    disabled={loading === plan.plan || isCurrent}
                    variant={isCurrent ? "outline" : "default"}
                  >
                    {loading === plan.plan && (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    {isCurrent ? "Active plan" : `Upgrade to ${plan.name}`}
                  </Button>
                )}
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
