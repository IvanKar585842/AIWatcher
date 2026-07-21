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
import { AlertTriangle, ArrowLeft, ArrowRight, HelpCircle, Loader2, Plus, Search, Sparkles } from "lucide-react";
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
  getMonitorTypeById,
  getMonitorTypesByCategory,
  getPrimaryMonitorTypes,
  getProtectedSiteWarning,
  MONITOR_TYPE_CATEGORIES,
  MONITOR_TYPE_CATALOG,
  type MonitorTypeCategory,
} from "@/lib/monitor-types";
import { loadUserSettings } from "@/lib/user-settings";
import { cn } from "@/lib/utils";
import { PRODUCT_TOUR_EVENTS } from "@/lib/product-tour";
import { SupportedSitesGuide } from "@/components/dashboard/supported-sites-guide";

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
  interval: MonitoringInterval.TWENTY_FOUR_HOURS as MonitoringInterval,
  notificationMethod: NotificationMethod.EMAIL as NotificationMethod,
  respectRobots: true,
};

function formDefaultsFromUserSettings() {
  const s = loadUserSettings();
  return {
    ...DEFAULT_FORM,
    mode: s.defaultMode,
    interval: s.defaultInterval,
    notificationMethod: s.defaultNotificationMethod,
  };
}

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
  /** Enables product-tour open/close events + data-tour anchors (Monitors page). */
  enableTourControl?: boolean;
}

function FieldLabel({
  children,
  hint,
}: {
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <div className="mb-1.5">
      <Label className="block text-xs font-medium text-zinc-400">{children}</Label>
      {hint ? <p className="mt-0.5 text-[11px] leading-snug text-zinc-600">{hint}</p> : null}
    </div>
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
  enableTourControl = false,
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
  const [selectedTypeId, setSelectedTypeId] = useState("full-page");
  const [typeFilter, setTypeFilter] = useState<MonitorTypeCategory | "All">("All");
  const [typeSearch, setTypeSearch] = useState("");
  const [showAdvancedTypes, setShowAdvancedTypes] = useState(false);

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
    if (!enableTourControl) return;
    try {
      if (sessionStorage.getItem("wf-open-create-after-tour") === "1") {
        sessionStorage.removeItem("wf-open-create-after-tour");
        setOpen(true);
      }
    } catch {
      /* ignore */
    }
  }, [enableTourControl, setOpen]);

  useEffect(() => {
    if (!enableTourControl) return;
    const openFromTour = () => setOpen(true);
    const closeFromTour = () => setOpen(false);
    window.addEventListener(PRODUCT_TOUR_EVENTS.OPEN_CREATE, openFromTour);
    window.addEventListener(PRODUCT_TOUR_EVENTS.CLOSE_CREATE, closeFromTour);
    return () => {
      window.removeEventListener(PRODUCT_TOUR_EVENTS.OPEN_CREATE, openFromTour);
      window.removeEventListener(PRODUCT_TOUR_EVENTS.CLOSE_CREATE, closeFromTour);
    };
  }, [enableTourControl, setOpen]);

  useEffect(() => {
    if (!open) {
      setStep(1);
      setError("");
      setTypeSearch("");
      setTypeFilter("All");
      setSelectedTypeId("full-page");
      setShowAdvancedTypes(false);
      return;
    }
    // Apply Settings → Monitoring preferences when opening a fresh create flow
    if (!prefillRequest) {
      setForm(formDefaultsFromUserSettings());
    }
  }, [open, prefillRequest]);

  const intervals = useMemo(
    () => allowedIntervals ?? (Object.keys(INTERVAL_LABELS) as MonitoringInterval[]),
    [allowedIntervals]
  );

  useEffect(() => {
    if (intervals.length > 0 && !intervals.includes(form.interval)) {
      setForm((prev) => ({ ...prev, interval: intervals[0]! }));
    }
  }, [intervals, form.interval]);

  const selectedType = useMemo(
    () => getMonitorTypeById(selectedTypeId) ?? MONITOR_TYPE_CATALOG[0],
    [selectedTypeId]
  );

  const protectedWarning = useMemo(
    () => getProtectedSiteWarning(form.url),
    [form.url]
  );

  const primaryTypes = useMemo(() => {
    const all = getPrimaryMonitorTypes();
    if (
      form.category &&
      MONITOR_TYPE_CATEGORIES.includes(form.category as MonitorTypeCategory)
    ) {
      const scoped = getMonitorTypesByCategory(form.category as MonitorTypeCategory);
      // Keep website primaries when category is Website; otherwise show category types as main grid
      if (form.category === "Website Monitoring") return all;
      return scoped.length > 0 ? scoped : all;
    }
    return all;
  }, [form.category]);

  const advancedTypes = useMemo(() => {
    const primaryIds = new Set(primaryTypes.map((t) => t.id));
    let list = MONITOR_TYPE_CATALOG.filter((t) => !primaryIds.has(t.id));
    if (
      form.category &&
      MONITOR_TYPE_CATEGORIES.includes(form.category as MonitorTypeCategory) &&
      form.category !== "Website Monitoring"
    ) {
      // Extra options outside the selected focus category
      list = MONITOR_TYPE_CATALOG.filter(
        (t) => !primaryIds.has(t.id) && t.category !== form.category
      );
    }
    return list;
  }, [form.category, primaryTypes]);

  const filteredAdvancedTypes = useMemo(() => {
    const q = typeSearch.trim().toLowerCase();
    return advancedTypes.filter((t) => {
      if (typeFilter !== "All" && t.category !== typeFilter) return false;
      if (!q) return true;
      return (
        t.label.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q) ||
        t.category.toLowerCase().includes(q) ||
        t.exampleUsage.toLowerCase().includes(q) ||
        t.recommendedUsers.toLowerCase().includes(q)
      );
    });
  }, [advancedTypes, typeFilter, typeSearch]);

  function validateStep1(): string | null {
    if (!form.url.trim()) return "Website URL is required";
    try {
      new URL(form.url);
    } catch {
      return "Please enter a valid URL (include https://)";
    }
    if (!form.name.trim()) return "Monitor name is required";
    return null;
  }

  function validateStep2(): string | null {
    if (selectedType.requiresSelector && !form.selector.trim()) {
      return form.mode === "XPATH"
        ? "Page section path is required"
        : "Page section is required";
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
    setForm((prev) => ({
      ...prev,
      mode: typeDef.mode,
      category: prev.category || typeDef.category,
      aiPrompt: typeDef.defaultAiPrompt
        ? typeDef.defaultAiPrompt
        : typeDef.requiresAiPrompt
          ? prev.aiPrompt
          : prev.aiPrompt,
      respectRobots:
        typeDef.mode === MonitoringMode.VISUAL_CHANGES ||
        typeDef.mode === MonitoringMode.SCREENSHOT_DIFF
          ? false
          : prev.respectRobots,
    }));
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
    setForm(formDefaultsFromUserSettings());
    setStep(1);
    onCreated?.(monitorId);
    router.push(`/dashboard/monitors/${monitorId}`);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {!hideTrigger && (
        <DialogTrigger asChild>
          <Button
            data-tour={enableTourControl ? "create-monitor-trigger" : undefined}
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
        data-tour={enableTourControl ? "create-monitor-dialog" : undefined}
        className="flex max-h-[min(92dvh,900px)] w-[min(calc(100vw-1rem),56rem)] max-w-none flex-col gap-0 overflow-hidden border border-cyan-500/20 bg-[#0a0a0a] p-0 text-zinc-100 shadow-[0_0_80px_-16px_rgba(34,211,238,0.45)] sm:w-[min(calc(100vw-1.5rem),56rem)]"
      >
        {/* Header */}
        <div className="shrink-0 border-b border-white/[0.06] bg-gradient-to-r from-cyan-500/[0.08] via-transparent to-blue-500/[0.05] px-4 py-4 pr-14 sm:px-7 sm:py-5 sm:pr-16">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-cyan-500/70">
                New monitor
              </p>
              <h2 className="mt-1 text-lg font-semibold text-zinc-50 sm:text-xl">Create AI Monitor</h2>
              <p className="mt-1 text-sm text-zinc-500">
                Step {step} of 2 — {step === 1 ? "Website details" : "How should we watch it?"}
              </p>
            </div>
            <Sparkles className="hidden h-5 w-5 shrink-0 text-cyan-500/40 sm:block" />
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
                  <FieldLabel hint="The public page you want WatchFlowing to check for changes.">
                    Website URL
                  </FieldLabel>
                  <OsInput
                    type="url"
                    placeholder="https://docs.example.com/getting-started"
                    value={form.url}
                    onChange={(e) => setForm({ ...form, url: e.target.value })}
                    autoFocus
                  />
                  {protectedWarning && (
                    <div className="mt-2 flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/[0.08] px-3 py-2.5 text-xs leading-relaxed text-amber-100/90">
                      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-300" />
                      <p>{protectedWarning}</p>
                    </div>
                  )}
                  <SupportedSitesGuide className="mt-3" />
                </div>
                <div>
                  <FieldLabel hint="A short name you’ll recognize in your dashboard.">
                    Monitor name
                  </FieldLabel>
                  <OsInput
                    placeholder="e.g. Competitor Pricing Page"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                  />
                </div>
                <div>
                  <FieldLabel hint="Optional — helps you organize monitors later.">Category</FieldLabel>
                  <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
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
                            "flex min-h-[88px] flex-col items-start gap-2 rounded-xl border p-3.5 text-left transition-all sm:min-h-[100px]",
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
                            <p className={cn("text-sm font-medium", active ? accent.text : "text-zinc-200")}>
                              {cat.label}
                            </p>
                            <p className="mt-0.5 line-clamp-2 text-xs leading-snug text-zinc-500">
                              {cat.description}
                            </p>
                          </div>
                        </motion.button>
                      );
                    })}
                  </div>
                </div>
                <div>
                  <FieldLabel hint="Optional notes for yourself.">Notes</FieldLabel>
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
                  <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                    <FieldLabel hint="Not sure? Keep Full Page Monitoring — it works for most sites.">
                      Monitoring type
                    </FieldLabel>
                    <p className="text-[11px] text-zinc-500 sm:mb-1.5">Start with Recommended</p>
                  </div>

                  <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                    {primaryTypes.map((typeDef) => {
                      const Icon = typeDef.icon;
                      const active = selectedTypeId === typeDef.id;
                      const accent = ACCENT_STYLES[typeDef.accent];
                      return (
                        <motion.button
                          key={typeDef.id}
                          type="button"
                          title={typeDef.tooltip ?? typeDef.description}
                          whileHover={{ scale: 1.01, y: -1 }}
                          whileTap={{ scale: 0.99 }}
                          onClick={() => selectMonitorType(typeDef.id)}
                          className={cn(
                            "relative flex min-h-[132px] flex-col items-start gap-2.5 rounded-xl border p-3.5 text-left transition-all sm:min-h-[140px]",
                            active
                              ? cn(accent.border, accent.bg, accent.glow, "ring-1 ring-cyan-400/30")
                              : "border-white/[0.06] bg-black/30 hover:border-cyan-500/20 hover:bg-white/[0.03]"
                          )}
                        >
                          <div className="flex w-full items-start justify-between gap-2">
                            <div
                              className={cn(
                                "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
                                active ? cn(accent.bg, accent.text) : "bg-white/[0.04] text-zinc-500"
                              )}
                            >
                              <Icon className="h-4 w-4" />
                            </div>
                            <div className="flex items-center gap-1.5">
                              {typeDef.recommended && (
                                <span className="rounded-full border border-cyan-400/30 bg-cyan-500/15 px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider text-cyan-200">
                                  Recommended
                                </span>
                              )}
                              <span
                                className="inline-flex text-zinc-600"
                                title={typeDef.tooltip ?? typeDef.description}
                                aria-label={typeDef.tooltip ?? typeDef.description}
                              >
                                <HelpCircle className="h-3.5 w-3.5" />
                              </span>
                            </div>
                          </div>
                          <div className="min-w-0 w-full">
                            <p className={cn("text-sm font-medium leading-tight", active ? accent.text : "text-zinc-100")}>
                              {typeDef.label}
                            </p>
                            <p className="mt-1 line-clamp-2 text-[11px] leading-snug text-zinc-500 sm:text-xs">
                              {typeDef.description}
                            </p>
                            <p className="mt-2 line-clamp-1 text-[10px] text-zinc-600">
                              <span className="text-zinc-500">Example:</span> {typeDef.exampleUsage}
                            </p>
                            <p className="mt-0.5 line-clamp-1 text-[10px] text-zinc-600">
                              <span className="text-zinc-500">Best for:</span>{" "}
                              {typeDef.recommendedUsers}
                            </p>
                          </div>
                        </motion.button>
                      );
                    })}
                  </div>

                  <div className="mt-4">
                    <button
                      type="button"
                      onClick={() => setShowAdvancedTypes((v) => !v)}
                      className="flex min-h-11 w-full items-center justify-between rounded-lg border border-white/[0.06] bg-black/20 px-3 py-2.5 text-left text-xs text-zinc-400 transition-colors hover:border-cyan-500/20 hover:text-zinc-200"
                    >
                      <span>
                        {showAdvancedTypes
                          ? "Hide extra options"
                          : "Need something more specific?"}
                      </span>
                      <span className="text-[10px] uppercase tracking-wider text-zinc-600">
                        {advancedTypes.length} options
                      </span>
                    </button>

                    <AnimatePresence initial={false}>
                      {showAdvancedTypes && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="overflow-hidden"
                        >
                          <div className="mt-3 mb-3 flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => setTypeFilter("All")}
                              className={cn(
                                "min-h-9 rounded-full border px-3 py-1.5 text-xs transition-colors",
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
                                  "min-h-9 rounded-full border px-3 py-1.5 text-xs transition-colors",
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
                              placeholder="Search options..."
                              className="pl-9"
                            />
                          </div>
                          {filteredAdvancedTypes.length === 0 ? (
                            <p className="rounded-lg border border-dashed border-white/[0.08] px-4 py-8 text-center text-sm text-zinc-500">
                              No matching options. Try another search or pick from the list above.
                            </p>
                          ) : (
                          <div className="grid max-h-[min(40vh,280px)] grid-cols-1 gap-2 overflow-y-auto overscroll-contain pr-1 sm:grid-cols-2">
                            {filteredAdvancedTypes.map((typeDef) => {
                              const Icon = typeDef.icon;
                              const active = selectedTypeId === typeDef.id;
                              const accent = ACCENT_STYLES[typeDef.accent];
                              return (
                                <motion.button
                                  key={typeDef.id}
                                  type="button"
                                  title={typeDef.description}
                                  whileHover={{ scale: 1.01 }}
                                  whileTap={{ scale: 0.99 }}
                                  onClick={() => selectMonitorType(typeDef.id)}
                                  className={cn(
                                    "flex min-h-[88px] flex-col items-start gap-2 rounded-xl border p-3 text-left transition-all",
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
                                    <span className="text-[9px] uppercase tracking-wider text-zinc-600">
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
                                    <p className="mt-1.5 line-clamp-1 text-[9px] text-zinc-600">
                                      Example: {typeDef.exampleUsage}
                                    </p>
                                    <p className="line-clamp-1 text-[9px] text-zinc-600">
                                      Best for: {typeDef.recommendedUsers}
                                    </p>
                                  </div>
                                </motion.button>
                              );
                            })}
                          </div>
                          )}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>

                {selectedType.requiresSelector && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}>
                    <FieldLabel
                      hint={
                        form.mode === "XPATH"
                          ? "Paste the path to the page section you care about."
                          : "Paste the CSS selector for the section you care about (ask support if unsure)."
                      }
                    >
                      {form.mode === "XPATH" ? "Page section path" : "Page section"}
                    </FieldLabel>
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
                    <FieldLabel hint="We’ll alert you when any of these words appear or change.">
                      Keywords to watch
                    </FieldLabel>
                    <OsInput
                      value={form.keywords}
                      onChange={(e) => setForm({ ...form, keywords: e.target.value })}
                      placeholder="sale, discount, remote"
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
                      <p className="text-sm font-medium text-cyan-100">AI Monitoring</p>
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
                    <FieldLabel hint="How often we check the page.">Check frequency</FieldLabel>
                    <Select
                      value={form.interval}
                      onValueChange={(v) => setForm({ ...form, interval: v as MonitoringInterval })}
                    >
                      <SelectTrigger className="min-h-11 border-white/[0.08] bg-black/50 text-zinc-100">
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
                    <FieldLabel hint="Where to send important alerts.">Alert method</FieldLabel>
                    <Select
                      value={form.notificationMethod}
                      onValueChange={(v) =>
                        setForm({ ...form, notificationMethod: v as NotificationMethod })
                      }
                    >
                      <SelectTrigger className="min-h-11 border-white/[0.08] bg-black/50 text-zinc-100">
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

                <div className="flex items-center justify-between gap-3 rounded-lg border border-white/[0.06] bg-black/30 px-4 py-3">
                  <div className="min-w-0">
                    <Label htmlFor="robots" className="text-sm text-zinc-300">
                      Follow website access rules
                    </Label>
                    <p className="mt-0.5 text-[11px] text-zinc-500">
                      {(form.mode === MonitoringMode.VISUAL_CHANGES ||
                        form.mode === MonitoringMode.SCREENSHOT_DIFF)
                        ? "Usually leave this off for visual / image checks."
                        : "Leave on unless the site blocks monitoring."}
                    </p>
                    <p className="mt-1 text-[11px] leading-snug text-zinc-600">
                      Prefer public pages. Marketplaces and social networks often block automated monitoring.
                    </p>
                  </div>
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
        <div className="flex shrink-0 flex-col-reverse gap-2 border-t border-white/[0.06] bg-black/40 px-4 py-4 sm:flex-row sm:justify-between sm:px-7">
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
              className="min-h-12 border-white/[0.08] bg-transparent text-zinc-400 hover:bg-white/[0.04] hover:text-zinc-200"
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
                className="min-h-12 w-full bg-cyan-500 text-black hover:bg-cyan-400 sm:w-auto"
              >
                Continue
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            ) : (
              <Button
                type="button"
                onClick={handleCreate}
                disabled={loading}
                className="min-h-12 w-full bg-cyan-500 text-black hover:bg-cyan-400 sm:w-auto"
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
