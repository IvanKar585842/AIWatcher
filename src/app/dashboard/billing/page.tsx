"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { Check, Crown, ExternalLink, Loader2, Sparkles, Zap } from "lucide-react";
import { CommandPageHeader } from "@/components/dashboard/command/command-page-header";
import { OsCard, OsUsageBar } from "@/components/dashboard/os/os-primitives";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/os-toast";
import { PRICING_PLANS } from "@/lib/constants";
import { fetchApi } from "@/lib/fetch-api";
import { cn } from "@/lib/utils";

interface BillingOverview {
  plan: "FREE" | "PRO" | "BUSINESS";
  limits: { maxMonitors: number | null; aiSummaries: boolean; telegram: boolean };
  usage: {
    monitors: number;
    aiAnalyses: number;
    monitoringChecks?: number;
    notifications: number;
    storageMb: number;
  };
  storageLimitMb: number | null;
  aiLimit: number | null;
  notificationLimit: number | null;
  payments?: {
    enabled: boolean;
    checkoutReady: boolean;
    missingEnv: string[];
  };
  subscription?: {
    status: string;
    renewalDate: string | null;
    cancelAtPeriodEnd: boolean;
  } | null;
  activeFeatures?: Array<{ name: string; label: string }>;
  comparison?: Array<{
    label: string;
    free: string;
    pro: string;
    business: string;
  }>;
  entitlements?: {
    historyDays: number | null;
    chatDailyMessages: number;
  };
}

export default function BillingPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
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

  useEffect(() => {
    const success = searchParams.get("success");
    const canceled = searchParams.get("canceled");
    if (!success && !canceled) return;

    if (success === "true") {
      toast("Payment successful — your plan will update in a moment.", "success");
      fetchApi<BillingOverview>("/api/billing/overview").then((result) => {
        if (result.success) setOverview(result.data);
      });
    } else if (canceled === "true") {
      toast("Checkout canceled. No charge was made.", "error");
    }

    router.replace("/dashboard/billing");
  }, [searchParams, router, toast]);

  // Pricing page deep-link: /dashboard/billing?plan=PRO
  useEffect(() => {
    const planIntent = searchParams.get("plan");
    if (planIntent !== "PRO" && planIntent !== "BUSINESS") return;
    if (overviewLoading || !overview) return;
    if (overview.plan !== "FREE") {
      router.replace("/dashboard/billing");
      return;
    }
    if (!overview.payments?.checkoutReady) {
      toast("Select a plan below when payments are enabled.", "success");
      router.replace("/dashboard/billing");
      return;
    }
    toast(`Ready to upgrade to ${planIntent}. Confirm below to continue.`, "success");
    router.replace("/dashboard/billing");
  }, [searchParams, overview, overviewLoading, router, toast]);

  async function handleUpgrade(plan: "PRO" | "BUSINESS") {
    if (overview?.payments && !overview.payments.checkoutReady) {
      toast("Payments are not configured yet. Add Stripe keys in the environment.", "error");
      return;
    }

    setLoading(plan);
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
        return;
      }
      toast(data.error || "Could not start checkout. Try again.", "error");
    } catch {
      toast("Could not start checkout. Check your connection.", "error");
    } finally {
      setLoading(null);
    }
  }

  async function openPortal() {
    setPortalLoading(true);
    try {
      const res = await fetch("/api/billing/checkout");
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
        return;
      }
      toast(data.error || "Billing portal is unavailable.", "error");
    } catch {
      toast("Could not open billing portal.", "error");
    } finally {
      setPortalLoading(false);
    }
  }

  const currentPlan = overview?.plan ?? "FREE";
  const paymentsReady = overview?.payments?.checkoutReady ?? false;
  const planCopy =
    currentPlan === "FREE"
      ? "You're exploring WatchFlowing. Upgrade when you want AI clarity, faster checks, and richer alerts."
      : currentPlan === "PRO"
        ? "You have AI analysis, faster intervals, visual monitoring, and Telegram — built for serious monitoring."
        : "Full team access with API, webhooks, priority processing, and unlimited AI.";

  return (
    <div className="space-y-8 p-4 lg:p-6">
      <CommandPageHeader
        label="Subscription"
        title="Billing"
        description="Pay for intelligence and automation — not just more monitors."
      >
        <Button
          variant="outline"
          onClick={openPortal}
          disabled={portalLoading || currentPlan === "FREE"}
          className="rounded-full border-white/[0.08] bg-white/[0.02] text-zinc-300 hover:border-cyan-500/30 hover:bg-cyan-500/10 hover:text-cyan-100"
        >
          {portalLoading ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <ExternalLink className="mr-2 h-4 w-4" />
          )}
          Manage billing
        </Button>
      </CommandPageHeader>

      {overview && !paymentsReady && (
        <div className="rounded-xl border border-amber-500/25 bg-amber-500/10 px-4 py-3 text-sm text-amber-100/90">
          Stripe keys are not set yet. Add them to <code className="text-amber-50">.env.local</code>{" "}
          / Vercel to enable paid upgrades. Checkout buttons stay disabled until then.
        </div>
      )}

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
                Usage
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
                label="Monitors"
                used={overview.usage.monitors}
                limit={overview.limits.maxMonitors}
              />
              <OsUsageBar
                label="Monitoring checks"
                used={overview.usage.monitoringChecks ?? 0}
                limit={null}
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

        <OsCard className="flex flex-col p-6">
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
          <p className="mt-4 text-sm leading-relaxed text-zinc-500">{planCopy}</p>

          {overview?.subscription?.renewalDate && currentPlan !== "FREE" && (
            <p className="mt-3 text-xs text-zinc-600">
              {overview.subscription.cancelAtPeriodEnd
                ? "Cancels on "
                : "Renews on "}
              {new Date(overview.subscription.renewalDate).toLocaleDateString()}
              {overview.subscription.status
                ? ` · Status: ${overview.subscription.status}`
                : ""}
            </p>
          )}

          {overview?.activeFeatures && overview.activeFeatures.length > 0 && (
            <div className="mt-5">
              <p className="mb-2 font-mono text-[10px] uppercase tracking-widest text-zinc-600">
                Active features
              </p>
              <div className="flex flex-wrap gap-1.5">
                {overview.activeFeatures.slice(0, 10).map((f) => (
                  <span
                    key={f.name}
                    className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-[10px] text-emerald-200/90"
                  >
                    {f.label}
                  </span>
                ))}
              </div>
            </div>
          )}
        </OsCard>
      </motion.div>

      <div>
        <p className="mb-4 font-mono text-[10px] uppercase tracking-[0.3em] text-cyan-500/60">
          Available upgrades
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
                  {plan.price > 0 && <span className="text-sm text-zinc-500">/mo</span>}
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
                    disabled={loading === plan.plan || isCurrent || !paymentsReady}
                    variant={isCurrent ? "outline" : "default"}
                  >
                    {loading === plan.plan && (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    {isCurrent
                      ? "Active plan"
                      : !paymentsReady
                        ? "Payments soon"
                        : `Upgrade to ${plan.name}`}
                  </Button>
                )}
              </motion.div>
            );
          })}
        </div>
      </div>

      {overview?.comparison && (
        <OsCard className="overflow-hidden p-0">
          <div className="border-b border-white/[0.06] px-6 py-4">
            <p className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">
              Feature comparison
            </p>
            <p className="mt-1 text-sm text-zinc-400">
              See why teams upgrade — intelligence, speed, and collaboration.
            </p>
          </div>
          <div className="space-y-3 p-4 md:hidden">
            {overview.comparison.map((row) => (
              <div
                key={row.label}
                className="rounded-xl border border-white/[0.06] bg-black/20 p-4"
              >
                <p className="text-sm font-medium text-zinc-200">{row.label}</p>
                <dl className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
                  <div>
                    <dt className="text-zinc-600">Free</dt>
                    <dd className="mt-1 text-zinc-400">{row.free}</dd>
                  </div>
                  <div>
                    <dt className="text-cyan-500/80">Pro</dt>
                    <dd className="mt-1 text-zinc-200">{row.pro}</dd>
                  </div>
                  <div>
                    <dt className="text-zinc-600">Biz</dt>
                    <dd className="mt-1 text-zinc-200">{row.business}</dd>
                  </div>
                </dl>
              </div>
            ))}
          </div>
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead>
                <tr className="border-b border-white/[0.06] text-xs text-zinc-500">
                  <th className="px-6 py-3 font-medium">Capability</th>
                  <th className="px-4 py-3 font-medium">Free</th>
                  <th className="px-4 py-3 font-medium text-cyan-300/90">Pro</th>
                  <th className="px-4 py-3 font-medium">Business</th>
                </tr>
              </thead>
              <tbody>
                {overview.comparison.map((row) => (
                  <tr key={row.label} className="border-b border-white/[0.04]">
                    <td className="px-6 py-3 text-zinc-300">{row.label}</td>
                    <td className="px-4 py-3 text-zinc-500">{row.free}</td>
                    <td className="px-4 py-3 text-zinc-200">{row.pro}</td>
                    <td className="px-4 py-3 text-zinc-200">{row.business}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </OsCard>
      )}
    </div>
  );
}
