"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  MonitoringInterval,
  MonitoringMode,
  NotificationMethod,
  type Monitor,
} from "@prisma/client";
import { ArrowLeft, ArrowRight, Loader2, Plus, Search, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/components/ui/os-toast";
import { INTERVAL_LABELS, NOTIFICATION_LABELS } from "@/lib/constants";
import { fetchApi } from "@/lib/fetch-api";
import {
  CREATE_AI_PROMPT_EXAMPLES,
  MONITOR_CATEGORY_DEFS,
} from "@/lib/monitor-config";
import {
  ACCENT_STYLES,
  MONITOR_TYPE_CATALOG,
  MONITOR_TYPE_CATEGORIES,
  getMonitorTypeById,
  type MonitorTypeCategory,
} from "@/lib/monitor-types";
import { cn } from "@/lib/utils";

export interface MonitorPrefill {
  name: string;
  url: string;
  description?: string;
  category?: string;
  mode: MonitoringMode;
  selector: string;
  keywords: string;
  aiPrompt?: string;
  interval: MonitoringInterval;
  notificationMethod: NotificationMethod;
  respectRobots: boolean;
}

const DEFAULT_FORM = {
  name: "",
  url: "",
  description: "",
  category: "",
  mode: MonitoringMode.ENTIRE_PAGE as MonitoringMode,
  selector: "",
  keywords: "",
  aiPrompt: "",
  interval: MonitoringInterval.TWELVE_HOURS as MonitoringInterval,
  notificationMethod: NotificationMethod.EMAIL as NotificationMethod,
  respectRobots: true,
};

interface CreateMonitorDialogProps {
  onCreated?: (monitorId: string) => void;
  allowedIntervals?: MonitoringInterval[];
  variant?: "default" | "os";
  prefillRequest?: MonitorPrefill | null;
  onPrefillConsumed?: () => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  hideTrigger?: boolean;
  triggerLabel?: string;
  triggerClassName?: string;
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <Label className="mb-1.5 block font-mono text-[10px] uppercase tracking-widest text-zinc-500">
      {children}
    </Label>
  );
}

function OsInput(props: React.ComponentProps<typeof Input>) {
  return (
    <Input
      {...props}
      className={cn(
        "border-white/[0.08] bg-black/50 text-zinc-100 placeholder:text-zinc-600 focus-visible:ring-cyan-500/40",
        props.className
      )}
    />
  );
}

export function CreateMonitorDialog({
  onCreated,
  allowedIntervals,
  variant = "default",
  prefillRequest,
  onPrefillConsumed,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
  hideTrigger = false,
  triggerLabel = "New Monitor",
  triggerClassName,
}: CreateMonitorDialogProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = controlledOnOpenChange ?? setInternalOpen;
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState(DEFAULT_FORM);
  const [selectedTypeId, setSelectedTypeId] = useState("entire-website");
  const [typeFilter, setTypeFilter] = useState<MonitorTypeCategory | "All">("All");
  const [typeSearch, setTypeSearch] = useState("");

  useEffect(() => {
    if (prefillRequest) {
      setForm({
        ...DEFAULT_FORM,
        ...prefillRequest,
        description: prefillRequest.description ?? "",
        category: prefillRequest.category ?? "",
        aiPrompt: prefillRequest.aiPrompt ?? "",
      });
      setStep(1);
      setOpen(true);
      onPrefillConsumed?.();
    }
  }, [prefillRequest, onPrefillConsumed, setOpen]);

  useEffect(() => {
    if (!open) {
      setStep(1);
      setError("");
      setTypeSearch("");
      setTypeFilter("All");
      setSelectedTypeId("entire-website");
    }
  }, [open]);

  const intervals = allowedIntervals ?? (Object.keys(INTERVAL_LABELS) as MonitoringInterval[]);
  const selectedType = useMemo(
    () => getMonitorTypeById(selectedTypeId) ?? MONITOR_TYPE_CATALOG[0],
    [selectedTypeId]
  );

  const filteredTypes = useMemo(() => {
    const q = typeSearch.trim().toLowerCase();
    return MONITOR_TYPE_CATALOG.filter((t) => {
      if (typeFilter !== "All" && t.category !== typeFilter) return false;
      if (!q) return true;
      return (
        t.label.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q) ||
        t.category.toLowerCase().includes(q)
      );
    });
  }, [typeFilter, typeSearch]);

  function validateStep1(): string | null {
    if (!form.url.trim()) return "Website URL is required";
    try {
      new URL(form.url);
    } catch {
      return "Please enter a valid URL (include https://)";
    }
    if (!form.name.trim()) return "Friendly name is required";
    return null;
  }

  function validateStep2(): string | null {
    if (selectedType.requiresSelector && !form.selector.trim()) {
      return form.mode === "XPATH" ? "XPath selector is required" : "CSS selector is required";
    }
    if (
      (selectedType.requiresKeywords || form.mode === "KEYWORD_DETECTION") &&
      !form.keywords.trim()
    ) {
      return "At least one keyword is required";
    }
    if (selectedType.requiresAiPrompt && !form.aiPrompt.trim()) {
      return "Describe what the AI should monitor";
    }
    return null;
  }

  function selectMonitorType(typeId: string) {
    const typeDef = getMonitorTypeById(typeId);
    if (!typeDef) return;
    setSelectedTypeId(typeId);
    setForm((prev) => ({ ...prev, mode: typeDef.mode }));
  }

  async function handleCreate() {
    const step1Error = validateStep1();
    if (step1Error) {
      setError(step1Error);
      setStep(1);
      return;
    }
    const step2Error = validateStep2();
    if (step2Error) {
      setError(step2Error);
      return;
    }

    setLoading(true);
    setError("");

    const result = await fetchApi<{ monitor: Monitor }>("/api/monitors", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.name.trim(),
        url: form.url.trim(),
        description: form.description.trim() || null,
        category: form.category || null,
        mode: form.mode,
        selector: form.selector.trim() || null,
        keywords: form.keywords
          ? form.keywords.split(",").map((k) => k.trim()).filter(Boolean)
          : [],
        aiPrompt: form.aiPrompt.trim() || null,
        config: { monitorTypeId: selectedTypeId },
        interval: form.interval,
        notificationMethod: form.notificationMethod,
        respectRobots: form.respectRobots,
      }),
    });

    setLoading(false);

    if (!result.success) {
      setError(result.error);
      toast(result.error, "error");
      return;
    }

    const monitorId = result.data.monitor.id;
    toast("Monitor created successfully", "success");
    setOpen(false);
    setForm(DEFAULT_FORM);
    setStep(1);
    onCreated?.(monitorId);
    router.push(`/dashboard/monitors/${monitorId}`);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {!hideTrigger && (
        <DialogTrigger asChild>
          <Button
            className={cn(
              triggerClassName,
              variant === "os"
                ? "rounded-full border border-cyan-400/25 bg-cyan-500/10 text-cyan-100 hover:border-cyan-300/40 hover:bg-cyan-500/15"
                : "bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-700 hover:to-violet-700"
            )}
          >
            {!triggerLabel.startsWith("+") && <Plus className="mr-2 h-4 w-4" />}
            {triggerLabel}
          </Button>
        </DialogTrigger>
      )}

      <DialogContent
        className="flex max-h-[min(92vh,900px)] w-[min(calc(100vw-1.5rem),56rem)] max-w-none flex-col gap-0 overflow-hidden border border-cyan-500/20 bg-[#0a0a0a] p-0 text-zinc-100 shadow-[0_0_80px_-16px_rgba(34,211,238,0.45)]"
      >
        {/* Header */}
        <div className="shrink-0 border-b border-white/[0.06] bg-gradient-to-r from-cyan-500/[0.08] via-transparent to-blue-500/[0.05] px-5 py-5 sm:px-7">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-cyan-500/70">
                Deploy Monitor
              </p>
              <h2 className="mt-1 text-xl font-semibold text-zinc-50">Create AI Monitor</h2>
              <p className="mt-1 text-sm text-zinc-500">
                Step {step} of 2 — {step === 1 ? "Target details" : "Monitoring configuration"}
              </p>
            </div>
            <Sparkles className="h-5 w-5 shrink-0 text-cyan-500/40" />
          </div>

          <div className="mt-4 flex gap-2">
            {[1, 2].map((s) => (
              <div
                key={s}
                className={cn(
                  "h-1 flex-1 rounded-full transition-colors duration-300",
                  s <= step ? "bg-cyan-400" : "bg-white/[0.08]"
                )}
              />
            ))}
          </div>
        </div>

        {/* Body */}
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-5 sm:px-7">
          <AnimatePresence mode="wait">
            {step === 1 ? (
              <motion.div
                key="step1"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.2 }}
                className="space-y-4"
              >
                <div>
                  <FieldLabel>Website URL</FieldLabel>
                  <OsInput
                    type="url"
                    placeholder="https://example.com/page"
                    value={form.url}
                    onChange={(e) => setForm({ ...form, url: e.target.value })}
                    autoFocus
                  />
                </div>
                <div>
                  <FieldLabel>Friendly Name</FieldLabel>
                  <OsInput
                    placeholder="e.g. Competitor Pricing Page"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                  />
                </div>
                <div>
                  <FieldLabel>Category</FieldLabel>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
                    {MONITOR_CATEGORY_DEFS.map((cat) => {
                      const Icon = cat.icon;
                      const active = form.category === cat.id;
                      const accent = ACCENT_STYLES[cat.accent];
                      return (
                        <motion.button
                          key={cat.id}
                          type="button"
                          whileHover={{ scale: 1.02, y: -2 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => setForm({ ...form, category: cat.id })}
                          className={cn(
                            "flex min-h-[100px] flex-col items-start gap-2 rounded-xl border p-3 text-left transition-all",
                            active
                              ? cn(accent.border, accent.bg, accent.glow)
                              : "border-white/[0.06] bg-black/30 hover:border-cyan-500/20 hover:bg-white/[0.03]"
                          )}
                        >
                          <div
                            className={cn(
                              "flex h-9 w-9 items-center justify-center rounded-lg",
                              active ? cn(accent.bg, accent.text) : "bg-white/[0.04] text-zinc-500"
                            )}
                          >
                            <Icon className="h-4 w-4" />
                          </div>
                          <div>
                            <p className={cn("text-xs font-medium", active ? accent.text : "text-zinc-200")}>
                              {cat.label}
                            </p>
                            <p className="mt-0.5 line-clamp-2 text-[10px] leading-snug text-zinc-500">
                              {cat.description}
                            </p>
                          </div>
                        </motion.button>
                      );
                    })}
                  </div>
                </div>
                <div>
                  <FieldLabel>Description</FieldLabel>
                  <textarea
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    placeholder="What should this monitor watch for?"
                    rows={3}
                    className="flex w-full rounded-md border border-white/[0.08] bg-black/50 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/40"
                  />
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="step2"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
                className="space-y-5"
              >
                <div>
                  <FieldLabel>Monitoring Type</FieldLabel>
                  <div className="mb-3 flex flex-wrap gap-1.5">
                    <button
                      type="button"
                      onClick={() => setTypeFilter("All")}
                      className={cn(
                        "rounded-full border px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider transition-colors",
                        typeFilter === "All"
                          ? "border-cyan-500/40 bg-cyan-500/15 text-cyan-200"
                          : "border-white/[0.06] text-zinc-500 hover:text-zinc-300"
                      )}
                    >
                      All
                    </button>
                    {MONITOR_TYPE_CATEGORIES.map((cat) => (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => setTypeFilter(cat)}
                        className={cn(
                          "rounded-full border px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider transition-colors",
                          typeFilter === cat
                            ? "border-cyan-500/40 bg-cyan-500/15 text-cyan-200"
                            : "border-white/[0.06] text-zinc-500 hover:text-zinc-300"
                        )}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                  <div className="relative mb-3">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-600" />
                    <OsInput
                      value={typeSearch}
                      onChange={(e) => setTypeSearch(e.target.value)}
                      placeholder="Search monitoring types..."
                      className="pl-9"
                    />
                  </div>
                  <div className="grid max-h-[280px] grid-cols-1 gap-2 overflow-y-auto pr-1 sm:grid-cols-2 lg:grid-cols-4">
                    {filteredTypes.map((typeDef) => {
                      const Icon = typeDef.icon;
                      const active = selectedTypeId === typeDef.id;
                      const accent = ACCENT_STYLES[typeDef.accent];
                      return (
                        <motion.button
                          key={typeDef.id}
                          type="button"
                          whileHover={{ scale: 1.02, y: -2 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => selectMonitorType(typeDef.id)}
                          className={cn(
                            "flex min-h-[96px] flex-col items-start gap-2 rounded-xl border p-3 text-left transition-all",
                            active
                              ? cn(accent.border, accent.bg, accent.glow, "ring-1 ring-cyan-400/30")
                              : "border-white/[0.06] bg-black/30 hover:border-cyan-500/20 hover:bg-white/[0.03]"
                          )}
                        >
                          <div className="flex w-full items-center justify-between gap-2">
                            <div
                              className={cn(
                                "flex h-8 w-8 items-center justify-center rounded-lg",
                                active ? cn(accent.bg, accent.text) : "bg-white/[0.04] text-zinc-500"
                              )}
                            >
                              <Icon className="h-4 w-4" />
                            </div>
                            <span className="font-mono text-[9px] uppercase tracking-wider text-zinc-600">
                              {typeDef.category}
                            </span>
                          </div>
                          <div className="min-w-0 w-full">
                            <p className={cn("text-xs font-medium leading-tight", active ? accent.text : "text-zinc-200")}>
                              {typeDef.label}
                            </p>
                            <p className="mt-0.5 line-clamp-2 text-[10px] leading-snug text-zinc-500">
                              {typeDef.description}
                            </p>
                          </div>
                        </motion.button>
                      );
                    })}
                  </div>
                </div>

                {selectedType.requiresSelector && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}>
                    <FieldLabel>{form.mode === "XPATH" ? "XPath" : "CSS Selector"}</FieldLabel>
                    <OsInput
                      value={form.selector}
                      onChange={(e) => setForm({ ...form, selector: e.target.value })}
                      placeholder={
                        form.mode === "XPATH" ? "//div[@class='price']" : ".product-price"
                      }
                      className="font-mono text-sm"
                    />
                  </motion.div>
                )}

                {(selectedType.requiresKeywords || form.mode === "KEYWORD_DETECTION") && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}>
                    <FieldLabel>Keywords</FieldLabel>
                    <OsInput
                      value={form.keywords}
                      onChange={(e) => setForm({ ...form, keywords: e.target.value })}
                      placeholder="sale, discount, remote (comma-separated)"
                    />
                  </motion.div>
                )}

                {(form.mode === "AI_SMART" || selectedType.requiresAiPrompt) && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="overflow-hidden rounded-xl border border-cyan-500/25 bg-gradient-to-br from-cyan-500/[0.08] to-violet-500/[0.04] shadow-[0_0_40px_-16px_rgba(34,211,238,0.4)]"
                  >
                    <div className="flex items-center gap-2 border-b border-cyan-500/15 px-4 py-3">
                      <Sparkles className="h-4 w-4 text-cyan-400" />
                      <p className="text-sm font-medium text-cyan-100">AI Smart Monitoring</p>
                    </div>
                    <div className="p-4">
                      <textarea
                        value={form.aiPrompt}
                        onChange={(e) => setForm({ ...form, aiPrompt: e.target.value })}
                        placeholder="Describe exactly what should be monitored."
                        rows={6}
                        className="min-h-[160px] w-full rounded-lg border border-white/[0.08] bg-black/40 px-3 py-3 text-sm leading-relaxed text-zinc-100 placeholder:text-zinc-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/40"
                      />
                      <p className="mt-3 font-mono text-[10px] uppercase tracking-widest text-zinc-600">
                        Examples
                      </p>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {CREATE_AI_PROMPT_EXAMPLES.map((example) => (
                          <button
                            key={example}
                            type="button"
                            onClick={() => setForm({ ...form, aiPrompt: example })}
                            className="rounded-full border border-white/[0.08] bg-black/30 px-2.5 py-1.5 text-left text-[10px] leading-snug text-zinc-500 transition-colors hover:border-cyan-500/30 hover:text-cyan-300"
                          >
                            {example}
                          </button>
                        ))}
                      </div>
                    </div>
                  </motion.div>
                )}

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <FieldLabel>Check Interval</FieldLabel>
                    <Select
                      value={form.interval}
                      onValueChange={(v) => setForm({ ...form, interval: v as MonitoringInterval })}
                    >
                      <SelectTrigger className="border-white/[0.08] bg-black/50 text-zinc-100">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {intervals.map((interval) => (
                          <SelectItem key={interval} value={interval}>
                            {INTERVAL_LABELS[interval]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <FieldLabel>Notifications</FieldLabel>
                    <Select
                      value={form.notificationMethod}
                      onValueChange={(v) =>
                        setForm({ ...form, notificationMethod: v as NotificationMethod })
                      }
                    >
                      <SelectTrigger className="border-white/[0.08] bg-black/50 text-zinc-100">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(NOTIFICATION_LABELS).map(([value, label]) => (
                          <SelectItem key={value} value={value}>
                            {label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="flex items-center justify-between rounded-lg border border-white/[0.06] bg-black/30 px-4 py-3">
                  <Label htmlFor="robots" className="text-sm text-zinc-300">
                    Respect robots.txt
                  </Label>
                  <Switch
                    id="robots"
                    checked={form.respectRobots}
                    onCheckedChange={(checked) => setForm({ ...form, respectRobots: checked })}
                    className="data-[state=checked]:bg-cyan-500"
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {error && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300"
            >
              {error}
            </motion.p>
          )}
        </div>

        {/* Footer */}
        <div className="flex shrink-0 flex-col-reverse gap-2 border-t border-white/[0.06] bg-black/40 px-5 py-4 sm:flex-row sm:justify-between sm:px-7">
          {step === 1 ? (
            <div />
          ) : (
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setStep(1);
                setError("");
              }}
              disabled={loading}
              className="border-white/[0.08] bg-transparent text-zinc-400 hover:bg-white/[0.04] hover:text-zinc-200"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Button>
          )}

          <div className="flex gap-2 sm:ml-auto">
            {step === 1 ? (
              <Button
                type="button"
                onClick={() => {
                  const err = validateStep1();
                  if (err) {
                    setError(err);
                    return;
                  }
                  setError("");
                  setStep(2);
                }}
                className="w-full bg-cyan-500 text-black hover:bg-cyan-400 sm:w-auto"
              >
                Continue
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            ) : (
              <Button
                type="button"
                onClick={handleCreate}
                disabled={loading}
                className="w-full bg-cyan-500 text-black hover:bg-cyan-400 sm:w-auto"
              >
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Create Monitor
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
