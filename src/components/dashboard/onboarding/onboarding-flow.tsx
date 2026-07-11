"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import {
  MonitoringInterval,
  MonitoringMode,
  NotificationMethod,
} from "@prisma/client";
import {
  ArrowRight,
  Bell,
  Brain,
  Check,
  Eye,
  Globe,
  Loader2,
  Mail,
  Plus,
  Radio,
  Sparkles,
  Target,
} from "lucide-react";
import {
  CreateMonitorDialog,
  type MonitorPrefill,
} from "@/components/dashboard/create-monitor-dialog";
import { os } from "@/components/dashboard/os/os-primitives";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/components/ui/os-toast";
import { loadUserSettings, saveUserSettings } from "@/lib/user-settings";
import { cn } from "@/lib/utils";

type OnboardingIntent = "my-website" | "competitor" | "important-page" | "price-changes";

const INTENTS: Array<{
  id: OnboardingIntent;
  label: string;
  description: string;
  icon: typeof Globe;
  accent: string;
}> = [
  {
    id: "my-website",
    label: "My website",
    description: "Watch your own site for unexpected changes.",
    icon: Globe,
    accent: "from-cyan-500/15 to-blue-500/5 border-cyan-500/30",
  },
  {
    id: "competitor",
    label: "Competitor website",
    description: "Track competitor pages for strategic updates.",
    icon: Eye,
    accent: "from-violet-500/15 to-purple-500/5 border-violet-500/30",
  },
  {
    id: "important-page",
    label: "Important page",
    description: "Monitor a critical article, docs, or landing page.",
    icon: Radio,
    accent: "from-emerald-500/15 to-teal-500/5 border-emerald-500/30",
  },
  {
    id: "price-changes",
    label: "Price changes",
    description: "Get alerts when product prices move.",
    icon: Target,
    accent: "from-amber-500/15 to-orange-500/5 border-amber-500/30",
  },
];

function buildPrefill(intent: OnboardingIntent): MonitorPrefill {
  const base = {
    url: "",
    selector: "",
    keywords: "",
    interval: MonitoringInterval.TWELVE_HOURS,
    notificationMethod: NotificationMethod.EMAIL,
    respectRobots: true,
  };

  switch (intent) {
    case "competitor":
      return {
        ...base,
        name: "Competitor website",
        category: "Other",
        description: "Track competitor page changes",
        mode: MonitoringMode.ENTIRE_PAGE,
      };
    case "important-page":
      return {
        ...base,
        name: "Important page",
        category: "Other",
        description: "Watch a critical page for updates",
        mode: MonitoringMode.TEXT_CHANGES,
      };
    case "price-changes":
      return {
        ...base,
        name: "Price tracker",
        category: "Pricing",
        description: "Alert me when the price changes",
        mode: MonitoringMode.PRICE_DETECTION,
      };
    case "my-website":
    default:
      return {
        ...base,
        name: "My website",
        category: "Other",
        description: "Monitor my website for important changes",
        mode: MonitoringMode.ENTIRE_PAGE,
      };
  }
}

interface OnboardingFlowProps {
  onComplete: () => void;
}

export function OnboardingFlow({ onComplete }: OnboardingFlowProps) {
  const { toast } = useToast();
  const [step, setStep] = useState(0);
  const [intent, setIntent] = useState<OnboardingIntent | null>(null);
  const [monitorCreated, setMonitorCreated] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [prefill, setPrefill] = useState<MonitorPrefill | null>(null);
  const [emailEnabled, setEmailEnabled] = useState(true);
  const [saving, setSaving] = useState(false);

  const steps = useMemo(
    () => ["Welcome", "Choose focus", "Create monitor", "Notifications"],
    []
  );

  async function finishOnboarding() {
    setSaving(true);
    try {
      const settings = loadUserSettings();
      saveUserSettings({
        ...settings,
        emailNotifications: emailEnabled,
        defaultNotificationMethod: emailEnabled
          ? NotificationMethod.EMAIL
          : settings.defaultNotificationMethod,
      });

      const res = await fetch("/api/user/onboarding", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          completed: true,
          intent: intent ?? undefined,
        }),
      });

      if (!res.ok) {
        throw new Error("Failed to save onboarding status");
      }

      toast("You're all set", "success");
      onComplete();
    } catch {
      toast("Could not finish onboarding. Please try again.", "error");
    } finally {
      setSaving(false);
    }
  }

  function openCreateMonitor() {
    if (!intent) return;
    setPrefill(buildPrefill(intent));
    setCreateOpen(true);
  }

  return (
    <div className={cn(os.page, "mx-auto max-w-3xl")}>
      <div className={cn(os.card, os.glow, "overflow-hidden")}>
        <div className="border-b border-white/[0.06] bg-gradient-to-r from-cyan-500/[0.08] via-transparent to-blue-500/[0.05] px-5 py-5 sm:px-8">
          <p className={os.label}>First-time setup</p>
          <h1 className="mt-2 text-2xl font-semibold text-zinc-50 sm:text-3xl">
            Welcome to WatchFlowing
          </h1>
          <p className="mt-2 max-w-xl text-sm text-zinc-500">
            Set up your first monitor in under a minute.
          </p>

          <div className="mt-5 flex gap-1.5">
            {steps.map((label, i) => (
              <div key={label} className="min-w-0 flex-1">
                <div
                  className={cn(
                    "h-1 rounded-full transition-colors",
                    i <= step ? "bg-cyan-400" : "bg-white/[0.08]"
                  )}
                />
                <p
                  className={cn(
                    "mt-2 hidden truncate font-mono text-[9px] uppercase tracking-wider sm:block",
                    i <= step ? "text-cyan-400/80" : "text-zinc-600"
                  )}
                >
                  {label}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="px-5 py-6 sm:px-8 sm:py-8">
          <AnimatePresence mode="wait">
            {step === 0 && (
              <motion.div
                key="welcome"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="space-y-5"
              >
                <p className="text-sm leading-relaxed text-zinc-400">
                  WatchFlowing (WatchFlowing) continuously monitors websites you care about,
                  detects meaningful changes, and explains them with AI — so you never miss
                  an important update.
                </p>

                <div className="grid gap-3 sm:grid-cols-3">
                  {[
                    {
                      icon: Globe,
                      title: "Website monitoring",
                      text: "We check pages on a schedule and compare them to the last snapshot.",
                    },
                    {
                      icon: Eye,
                      title: "Change detection",
                      text: "Noise like ads and timestamps is filtered so you see real updates.",
                    },
                    {
                      icon: Brain,
                      title: "AI analysis",
                      text: "AI summarizes what changed and whether it is worth alerting you.",
                    },
                  ].map((item) => {
                    const Icon = item.icon;
                    return (
                      <div
                        key={item.title}
                        className="rounded-xl border border-white/[0.06] bg-black/30 p-4"
                      >
                        <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg border border-cyan-400/20 bg-cyan-500/10 text-cyan-300">
                          <Icon className="h-4 w-4" />
                        </div>
                        <p className="text-sm font-medium text-zinc-100">{item.title}</p>
                        <p className="mt-1 text-xs leading-relaxed text-zinc-500">{item.text}</p>
                      </div>
                    );
                  })}
                </div>

                <div className="flex justify-end pt-2">
                  <Button
                    type="button"
                    onClick={() => setStep(1)}
                    className={cn(os.btnPrimary, "px-5")}
                  >
                    Get started
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              </motion.div>
            )}

            {step === 1 && (
              <motion.div
                key="intent"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="space-y-5"
              >
                <div>
                  <h2 className="text-lg font-semibold text-zinc-100">
                    Step 1 — Choose what you want to monitor
                  </h2>
                  <p className="mt-1 text-sm text-zinc-500">
                    Pick a starting goal. You can create more monitors anytime.
                  </p>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  {INTENTS.map((option) => {
                    const Icon = option.icon;
                    const active = intent === option.id;
                    return (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => setIntent(option.id)}
                        className={cn(
                          "rounded-xl border bg-gradient-to-br p-4 text-left transition-all",
                          active
                            ? cn(option.accent, "ring-1 ring-cyan-400/30")
                            : "border-white/[0.06] bg-black/20 hover:border-cyan-500/20"
                        )}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-white/[0.08] bg-black/30 text-cyan-300">
                            <Icon className="h-5 w-5" />
                          </div>
                          {active && (
                            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-cyan-500/20 text-cyan-300">
                              <Check className="h-3.5 w-3.5" />
                            </span>
                          )}
                        </div>
                        <p className="mt-3 text-sm font-medium text-zinc-100">{option.label}</p>
                        <p className="mt-1 text-xs text-zinc-500">{option.description}</p>
                      </button>
                    );
                  })}
                </div>

                <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setStep(0)}
                    className="border-white/[0.08] bg-transparent text-zinc-400"
                  >
                    Back
                  </Button>
                  <Button
                    type="button"
                    disabled={!intent}
                    onClick={() => setStep(2)}
                    className={cn(os.btnPrimary, "px-5")}
                  >
                    Continue
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              </motion.div>
            )}

            {step === 2 && (
              <motion.div
                key="create"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="space-y-5"
              >
                <div>
                  <h2 className="text-lg font-semibold text-zinc-100">
                    Step 2 — Create your first monitor
                  </h2>
                  <p className="mt-1 text-sm text-zinc-500">
                    Add a URL and we will start watching it for meaningful changes.
                  </p>
                </div>

                <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/[0.06] p-5">
                  <div className="flex items-start gap-3">
                    <Sparkles className="mt-0.5 h-5 w-5 text-cyan-400" />
                    <div>
                      <p className="text-sm font-medium text-cyan-100">
                        {intent
                          ? INTENTS.find((i) => i.id === intent)?.label
                          : "Monitor"}
                      </p>
                      <p className="mt-1 text-xs text-zinc-400">
                        We will prefill the recommended monitoring type for your choice.
                        You can adjust everything in the create dialog.
                      </p>
                    </div>
                  </div>

                  <div className="mt-4">
                    {monitorCreated ? (
                      <div className="flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2.5 text-sm text-emerald-200">
                        <Check className="h-4 w-4" />
                        Monitor created successfully
                      </div>
                    ) : (
                      <Button
                        type="button"
                        onClick={openCreateMonitor}
                        className="w-full bg-cyan-500 text-black hover:bg-cyan-400 sm:w-auto"
                      >
                        <Plus className="mr-2 h-4 w-4" />
                        Create first monitor
                      </Button>
                    )}
                  </div>
                </div>

                <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setStep(1)}
                    className="border-white/[0.08] bg-transparent text-zinc-400"
                  >
                    Back
                  </Button>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    {!monitorCreated && (
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setStep(3)}
                        className="border-white/[0.08] bg-transparent text-zinc-400"
                      >
                        Skip for now
                      </Button>
                    )}
                    <Button
                      type="button"
                      disabled={!monitorCreated}
                      onClick={() => setStep(3)}
                      className={cn(os.btnPrimary, "px-5")}
                    >
                      Continue
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </motion.div>
            )}

            {step === 3 && (
              <motion.div
                key="notify"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="space-y-5"
              >
                <div>
                  <h2 className="text-lg font-semibold text-zinc-100">
                    Step 3 — Enable notifications
                  </h2>
                  <p className="mt-1 text-sm text-zinc-500">
                    Choose how you want to be notified when something important changes.
                  </p>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-4 rounded-xl border border-white/[0.06] bg-black/30 px-4 py-4">
                    <div className="flex items-start gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-emerald-500/20 bg-emerald-500/10 text-emerald-300">
                        <Mail className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-zinc-100">Email notifications</p>
                        <p className="mt-0.5 text-xs text-zinc-500">
                          Recommended. Alerts go to your account email.
                        </p>
                      </div>
                    </div>
                    <Switch
                      checked={emailEnabled}
                      onCheckedChange={setEmailEnabled}
                      className="data-[state=checked]:bg-cyan-500"
                    />
                  </div>

                  <div className="rounded-xl border border-white/[0.06] bg-black/20 px-4 py-4">
                    <div className="flex items-start gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-cyan-500/20 bg-cyan-500/10 text-cyan-300">
                        <Bell className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-zinc-100">Telegram (optional)</p>
                        <p className="mt-0.5 text-xs text-zinc-500">
                          Connect Telegram later in Settings for instant mobile alerts.
                        </p>
                        <Link
                          href="/dashboard/settings"
                          className="mt-2 inline-block text-xs text-cyan-400 hover:text-cyan-300"
                        >
                          Open Settings →
                        </Link>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setStep(2)}
                    className="border-white/[0.08] bg-transparent text-zinc-400"
                  >
                    Back
                  </Button>
                  <Button
                    type="button"
                    disabled={saving}
                    onClick={finishOnboarding}
                    className="bg-cyan-500 text-black hover:bg-cyan-400"
                  >
                    {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Finish setup
                  </Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      <CreateMonitorDialog
        hideTrigger
        open={createOpen}
        onOpenChange={setCreateOpen}
        prefillRequest={prefill}
        onPrefillConsumed={() => setPrefill(null)}
        variant="os"
        onCreated={async () => {
          setMonitorCreated(true);
          setCreateOpen(false);
          toast("First monitor created", "success");
          // Persist + dismiss welcome immediately (refresh/login already covered server-side)
          try {
            await fetch("/api/user/onboarding", {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                completed: true,
                intent: intent ?? undefined,
              }),
            });
          } catch {
            // Monitor create already marks completion server-side
          }
          onComplete();
        }}
      />
    </div>
  );
}
