"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertTriangle,
  Archive,
  Bell,
  ChevronDown,
  ExternalLink,
  HelpCircle,
  Mail,
  MessageCircle,
  Pause,
  RefreshCw,
  RotateCcw,
  Save,
  Send,
  Trash2,
} from "lucide-react";
import type { MonitoringInterval, MonitoringMode, NotificationMethod, Plan } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  getAllowedIntervals,
  INTERVAL_LABELS,
  NOTIFICATION_LABELS,
} from "@/lib/constants";
import {
  AI_PROMPT_EXAMPLES,
  ADVANCED_MONITORING_MODES,
  DEFAULT_MONITOR_CONFIG,
  MONITOR_CATEGORIES,
  PRIMARY_MONITORING_MODES,
  MONITORING_MODES,
  parseMonitorConfig,
  type MonitorConfig,
} from "@/lib/monitor-config";
import { cn, formatRelativeTime, getDomainFromUrl, getFaviconUrl } from "@/lib/utils";

interface MonitorChange {
  id: string;
  summary: string;
  emoji: string;
  importance: string;
  createdAt: string;
}

interface MonitorData {
  id: string;
  name: string;
  url: string;
  description: string | null;
  category: string | null;
  tags: string[];
  aiPrompt: string | null;
  config: unknown;
  mode: MonitoringMode;
  selector: string | null;
  keywords: string[];
  interval: MonitoringInterval;
  notificationMethod: NotificationMethod;
  respectRobots: boolean;
  status: string;
  lastCheckedAt: string | null;
  lastChangedAt: string | null;
  errorMessage: string | null;
  changes: MonitorChange[];
  _count: { changes: number; snapshots: number };
}

interface SettingsSectionProps {
  id: string;
  title: string;
  subtitle?: string;
  icon: React.ReactNode;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
  accent?: string;
}

function SettingsSection({
  title,
  subtitle,
  icon,
  open,
  onToggle,
  children,
  accent = "from-cyan-500/10 to-blue-500/5",
}: SettingsSectionProps) {
  return (
    <motion.div
      layout
      className="overflow-hidden rounded-xl border border-white/[0.06] bg-white/[0.02] backdrop-blur-sm"
    >
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center gap-4 px-5 py-4 text-left transition-colors hover:bg-white/[0.03]"
      >
        <div
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br ${accent} border border-white/[0.08] text-cyan-300`}
        >
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-medium text-zinc-100">{title}</p>
          {subtitle && <p className="mt-0.5 text-xs text-zinc-500">{subtitle}</p>}
        </div>
        <motion.div animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.2 }}>
          <ChevronDown className="h-5 w-5 text-zinc-500" />
        </motion.div>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
            className="overflow-hidden"
          >
            <div className="border-t border-white/[0.06] px-5 py-5">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
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
      className={`border-white/[0.08] bg-black/40 text-zinc-100 placeholder:text-zinc-600 focus-visible:ring-cyan-500/40 ${props.className ?? ""}`}
    />
  );
}

function OsTextarea(props: React.ComponentProps<"textarea">) {
  return (
    <textarea
      {...props}
      className={`flex min-h-[80px] w-full rounded-md border border-white/[0.08] bg-black/40 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/40 disabled:cursor-not-allowed disabled:opacity-50 ${props.className ?? ""}`}
    />
  );
}

function ToggleRow({
  label,
  description,
  checked,
  onCheckedChange,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-lg border border-white/[0.04] bg-black/20 px-4 py-3">
      <div>
        <p className="text-sm text-zinc-200">{label}</p>
        {description && <p className="mt-0.5 text-xs text-zinc-500">{description}</p>}
      </div>
      <Switch
        checked={checked}
        onCheckedChange={onCheckedChange}
        className="data-[state=checked]:bg-cyan-500"
      />
    </div>
  );
}

export function MonitorSettings({ monitorId }: { monitorId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [checking, setChecking] = useState(false);
  const [saved, setSaved] = useState(false);
  const [plan, setPlan] = useState<Plan>("FREE");
  const [monitor, setMonitor] = useState<MonitorData | null>(null);

  const [openSections, setOpenSections] = useState({
    general: true,
    modes: true,
    advanced: false,
    notifications: true,
    danger: false,
  });
  const [showAdvancedModes, setShowAdvancedModes] = useState(false);
  const savedTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (savedTimeoutRef.current) clearTimeout(savedTimeoutRef.current);
    };
  }, []);

  const [form, setForm] = useState({
    name: "",
    url: "",
    description: "",
    category: "",
    tagsInput: "",
    enabled: true,
    mode: "ENTIRE_PAGE" as MonitoringMode,
    selector: "",
    keywordsInput: "",
    aiPrompt: "",
    interval: "TWELVE_HOURS" as MonitoringInterval,
    notificationMethod: "EMAIL" as NotificationMethod,
    respectRobots: true,
    config: { ...DEFAULT_MONITOR_CONFIG } as MonitorConfig,
  });

  const loadMonitor = useCallback(async (signal?: AbortSignal) => {
    const res = await fetch(`/api/monitors/${monitorId}`, { signal });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data.monitor) return null;
    setPlan(data.plan ?? "FREE");
    return data.monitor as MonitorData;
  }, [monitorId]);

  useEffect(() => {
    const controller = new AbortController();
    loadMonitor(controller.signal)
      .then((m) => {
        if (!m) return;
        setMonitor(m);
        const cfg = parseMonitorConfig(m.config);
        setForm({
          name: m.name,
          url: m.url,
          description: m.description ?? "",
          category: m.category ?? "",
          tagsInput: (m.tags ?? []).join(", "),
          enabled: m.status === "ACTIVE",
          mode: m.mode,
          selector: m.selector ?? "",
          keywordsInput: (m.keywords ?? []).join(", "),
          aiPrompt: m.aiPrompt ?? "",
          interval: m.interval,
          notificationMethod: m.notificationMethod,
          respectRobots: m.respectRobots,
          config: cfg,
        });
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [loadMonitor]);

  const selectedMode = useMemo(
    () => MONITORING_MODES.find((m) => m.mode === form.mode),
    [form.mode]
  );

  const allowedIntervals = useMemo(() => getAllowedIntervals(plan), [plan]);

  function toggleSection(key: keyof typeof openSections) {
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  function updateConfig(patch: Partial<MonitorConfig>) {
    setForm((prev) => ({ ...prev, config: { ...prev.config, ...patch } }));
  }

  async function saveSettings() {
    setSaving(true);
    setSaved(false);
    const tags = form.tagsInput
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
    const keywords = form.keywordsInput
      .split(",")
      .map((k) => k.trim())
      .filter(Boolean);

    const payload = {
      name: form.name,
      url: form.url,
      description: form.description || null,
      category: form.category || null,
      tags,
      mode: form.mode,
      selector: form.selector || null,
      keywords,
      aiPrompt: form.aiPrompt || null,
      interval: form.interval,
      notificationMethod: form.notificationMethod,
      respectRobots: form.respectRobots,
      status: form.enabled ? "ACTIVE" : "PAUSED",
      config: form.config,
    };

    const res = await fetch(`/api/monitors/${monitorId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (res.ok) {
      const data = await res.json();
      setMonitor((prev) => (prev ? { ...prev, ...data.monitor } : prev));
      setSaved(true);
      if (savedTimeoutRef.current) clearTimeout(savedTimeoutRef.current);
      savedTimeoutRef.current = setTimeout(() => setSaved(false), 2500);
    }
    setSaving(false);
  }

  async function checkNow() {
    setChecking(true);
    await fetch(`/api/monitors/${monitorId}/check`, { method: "POST" });
    const m = await loadMonitor();
    if (m) setMonitor(m);
    setChecking(false);
  }

  async function resetHistory() {
    if (!confirm("Reset all change history and snapshots for this monitor?")) return;
    await fetch(`/api/monitors/${monitorId}/reset-history`, { method: "POST" });
    const m = await loadMonitor();
    if (m) setMonitor(m);
  }

  async function pauseMonitor() {
    await fetch(`/api/monitors/${monitorId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "PAUSED" }),
    });
    setForm((prev) => ({ ...prev, enabled: false }));
    const m = await loadMonitor();
    if (m) setMonitor(m);
  }

  async function archiveMonitor() {
    if (!confirm("Archive this monitor? It will be paused and hidden from active monitoring.")) return;
    await fetch(`/api/monitors/${monitorId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status: "PAUSED",
        config: { ...form.config, archived: true },
      }),
    });
    router.push("/dashboard/monitors");
  }

  async function deleteMonitor() {
    if (!confirm("Permanently delete this monitor? This cannot be undone.")) return;
    await fetch(`/api/monitors/${monitorId}`, { method: "DELETE" });
    router.push("/dashboard/monitors");
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-16 w-full rounded-xl bg-white/5" />
        <Skeleton className="h-48 w-full rounded-xl bg-white/5" />
        <Skeleton className="h-48 w-full rounded-xl bg-white/5" />
      </div>
    );
  }

  if (!monitor) {
    return <p className="text-zinc-500">Monitor not found.</p>;
  }

  const isArchived = form.config.archived;

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col gap-4 rounded-xl border border-white/[0.06] bg-gradient-to-br from-cyan-500/[0.06] via-transparent to-blue-500/[0.04] p-5 sm:flex-row sm:items-center sm:justify-between"
      >
        <div className="flex items-start gap-4">
          <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-xl border border-white/[0.08] bg-black/50">
            <Image
              src={getFaviconUrl(monitor.url)}
              alt=""
              width={48}
              height={48}
              className="h-full w-full object-cover"
              unoptimized
            />
          </div>
          <div className="min-w-0">
            <p className="font-mono text-[10px] uppercase tracking-widest text-cyan-400/80">
              Monitor Configuration
            </p>
            <h1 className="mt-1 truncate text-xl font-semibold text-zinc-50">{form.name}</h1>
            <p className="mt-0.5 truncate text-sm text-zinc-500">{getDomainFromUrl(form.url)}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={checkNow}
            disabled={checking}
            className="border-white/[0.08] bg-black/30 text-zinc-300 hover:bg-white/[0.05] hover:text-cyan-300"
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${checking ? "animate-spin" : ""}`} />
            Check Now
          </Button>
          <a href={form.url} target="_blank" rel="noopener noreferrer">
            <Button
              variant="outline"
              className="border-white/[0.08] bg-black/30 text-zinc-300 hover:bg-white/[0.05] hover:text-cyan-300"
            >
              <ExternalLink className="mr-2 h-4 w-4" />
              Open Site
            </Button>
          </a>
          <Button
            onClick={saveSettings}
            disabled={saving}
            className="bg-cyan-500 text-black hover:bg-cyan-400"
          >
            <Save className="mr-2 h-4 w-4" />
            {saving ? "Saving…" : saved ? "Saved" : "Save Changes"}
          </Button>
        </div>
      </motion.div>

      {monitor.errorMessage && (
        <div className="flex items-start gap-3 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          {monitor.errorMessage}
        </div>
      )}

      {isArchived && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
          This monitor is archived and paused.
        </div>
      )}

      <div className="space-y-4">
        {/* General */}
        <SettingsSection
          id="general"
          title="General"
          subtitle="Name, URL, monitoring type, frequency, and status"
          icon={<span className="text-lg">⚙</span>}
          open={openSections.general}
          onToggle={() => toggleSection("general")}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <FieldLabel>Monitor Name</FieldLabel>
              <OsInput value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="sm:col-span-2">
              <FieldLabel>Website URL</FieldLabel>
              <OsInput value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} />
            </div>
            <div>
              <FieldLabel>Monitoring Type</FieldLabel>
              <Select
                value={form.mode}
                onValueChange={(v) => setForm({ ...form, mode: v as MonitoringMode })}
              >
                <SelectTrigger className="border-white/[0.08] bg-black/40 text-zinc-100">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MONITORING_MODES.map((modeDef) => (
                    <SelectItem key={modeDef.mode} value={modeDef.mode}>
                      {modeDef.label}
                      {modeDef.recommended ? " · Recommended" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <FieldLabel>Check Frequency</FieldLabel>
              <Select
                value={form.interval}
                onValueChange={(v) => setForm({ ...form, interval: v as MonitoringInterval })}
              >
                <SelectTrigger className="border-white/[0.08] bg-black/40 text-zinc-100">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {allowedIntervals.map((interval) => (
                    <SelectItem key={interval} value={interval}>
                      {INTERVAL_LABELS[interval]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <FieldLabel>Category</FieldLabel>
              <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                <SelectTrigger className="border-white/[0.08] bg-black/40 text-zinc-100">
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {MONITOR_CATEGORIES.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="sm:col-span-2">
              <FieldLabel>Description</FieldLabel>
              <OsTextarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="What are you monitoring and why?"
                rows={3}
              />
            </div>
            <div className="sm:col-span-2">
              <FieldLabel>Tags</FieldLabel>
              <OsInput
                value={form.tagsInput}
                onChange={(e) => setForm({ ...form, tagsInput: e.target.value })}
                placeholder="pricing, jobs, scholarships (comma-separated)"
              />
            </div>
            <div className="sm:col-span-2">
              <ToggleRow
                label="Active Status"
                description="When disabled, checks are paused"
                checked={form.enabled}
                onCheckedChange={(enabled) => setForm({ ...form, enabled })}
              />
            </div>
          </div>
        </SettingsSection>

        {/* Monitoring Modes */}
        <SettingsSection
          id="modes"
          title="Monitoring Modes"
          subtitle="Choose how WatchFlowing detects changes"
          icon={<span className="text-lg">◎</span>}
          open={openSections.modes}
          onToggle={() => toggleSection("modes")}
          accent="from-violet-500/10 to-cyan-500/5"
        >
          <div className="grid gap-2 sm:grid-cols-2">
            {PRIMARY_MONITORING_MODES.map((modeDef) => {
              const Icon = modeDef.icon;
              const active = form.mode === modeDef.mode;
              return (
                <motion.button
                  key={modeDef.mode}
                  type="button"
                  title={modeDef.tooltip ?? modeDef.description}
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.99 }}
                  onClick={() => setForm({ ...form, mode: modeDef.mode })}
                  className={cn(
                    "relative flex items-start gap-3 rounded-lg border p-3 text-left transition-all",
                    active
                      ? "border-cyan-500/50 bg-cyan-500/10 shadow-[0_0_20px_-8px_rgba(34,211,238,0.5)]"
                      : "border-white/[0.06] bg-black/20 hover:border-white/[0.12] hover:bg-white/[0.03]"
                  )}
                >
                  <div
                    className={cn(
                      "flex h-9 w-9 shrink-0 items-center justify-center rounded-md",
                      active ? "bg-cyan-500/20 text-cyan-300" : "bg-white/[0.04] text-zinc-400"
                    )}
                  >
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className={cn("text-sm font-medium", active ? "text-cyan-100" : "text-zinc-200")}>
                        {modeDef.label}
                      </p>
                      {modeDef.recommended && (
                        <span className="rounded-full border border-cyan-400/30 bg-cyan-500/15 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-cyan-200">
                          Recommended
                        </span>
                      )}
                      <HelpCircle
                        className="h-3.5 w-3.5 text-zinc-600"
                        aria-label={modeDef.tooltip ?? modeDef.description}
                      />
                    </div>
                    <p className="mt-0.5 line-clamp-2 text-xs text-zinc-500">{modeDef.description}</p>
                  </div>
                </motion.button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={() => setShowAdvancedModes((v) => !v)}
            className="mt-3 flex w-full items-center justify-between rounded-lg border border-white/[0.06] bg-black/20 px-3 py-2.5 text-left text-xs text-zinc-400 transition-colors hover:border-cyan-500/20 hover:text-zinc-200"
          >
            <span>{showAdvancedModes ? "Hide advanced modes" : "Show advanced modes"}</span>
            <span className="font-mono text-[10px] uppercase tracking-wider text-zinc-600">
              {ADVANCED_MONITORING_MODES.length} more
            </span>
          </button>

          <AnimatePresence initial={false}>
            {showAdvancedModes && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {ADVANCED_MONITORING_MODES.map((modeDef) => {
                    const Icon = modeDef.icon;
                    const active = form.mode === modeDef.mode;
                    return (
                      <button
                        key={modeDef.mode}
                        type="button"
                        title={modeDef.description}
                        onClick={() => setForm({ ...form, mode: modeDef.mode })}
                        className={cn(
                          "flex items-start gap-3 rounded-lg border p-3 text-left transition-all",
                          active
                            ? "border-cyan-500/50 bg-cyan-500/10"
                            : "border-white/[0.06] bg-black/20 hover:bg-white/[0.03]"
                        )}
                      >
                        <div
                          className={cn(
                            "flex h-8 w-8 shrink-0 items-center justify-center rounded-md",
                            active ? "bg-cyan-500/20 text-cyan-300" : "bg-white/[0.04] text-zinc-400"
                          )}
                        >
                          <Icon className="h-4 w-4" />
                        </div>
                        <div className="min-w-0">
                          <p className={cn("text-sm font-medium", active ? "text-cyan-100" : "text-zinc-200")}>
                            {modeDef.label}
                          </p>
                          <p className="mt-0.5 line-clamp-2 text-xs text-zinc-500">{modeDef.description}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {selectedMode?.requiresSelector && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              className="mt-4"
            >
              <FieldLabel>{form.mode === "XPATH" ? "Page section path" : "Page section"}</FieldLabel>
              <OsInput
                value={form.selector}
                onChange={(e) => setForm({ ...form, selector: e.target.value })}
                placeholder={form.mode === "XPATH" ? "//div[@class='price']" : ".product-price"}
                className="font-mono text-sm"
              />
            </motion.div>
          )}

          {(selectedMode?.requiresKeywords || form.mode === "KEYWORD_DETECTION") && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              className="mt-4"
            >
              <FieldLabel>Keywords</FieldLabel>
              <OsInput
                value={form.keywordsInput}
                onChange={(e) => setForm({ ...form, keywordsInput: e.target.value })}
                placeholder="frontend, remote, scholarship (comma-separated)"
              />
            </motion.div>
          )}

          {(selectedMode?.requiresAiPrompt || form.mode === "AI_SMART") && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-5 rounded-xl border border-cyan-500/20 bg-gradient-to-br from-cyan-500/[0.08] to-violet-500/[0.04] p-4"
            >
              <div className="mb-3 flex items-center gap-2">
                <span className="text-lg">🧠</span>
                <div>
                  <p className="font-medium text-cyan-100">AI Monitoring</p>
                  <p className="text-xs text-zinc-500">
                    Describe what should trigger a notification in natural language
                  </p>
                </div>
              </div>
              <OsTextarea
                value={form.aiPrompt}
                onChange={(e) => setForm({ ...form, aiPrompt: e.target.value })}
                placeholder="Tell the AI exactly what to watch for…"
                rows={6}
                className="min-h-[160px] text-base leading-relaxed"
              />
              <div className="mt-3">
                <p className="mb-2 font-mono text-[10px] uppercase tracking-widest text-zinc-500">
                  Examples — click to use
                </p>
                <div className="flex flex-wrap gap-2">
                  {AI_PROMPT_EXAMPLES.map((example) => (
                    <button
                      key={example}
                      type="button"
                      onClick={() => setForm({ ...form, aiPrompt: example })}
                      className="rounded-full border border-white/[0.08] bg-black/30 px-3 py-1.5 text-left text-xs text-zinc-400 transition-colors hover:border-cyan-500/30 hover:text-cyan-300"
                    >
                      {example}
                    </button>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </SettingsSection>

        {/* Advanced */}
        <SettingsSection
          id="advanced"
          title="Advanced Settings"
          subtitle="Noise filters, selectors, and fetch behavior"
          icon={<span className="text-lg">⬡</span>}
          open={openSections.advanced}
          onToggle={() => toggleSection("advanced")}
          accent="from-zinc-500/10 to-zinc-600/5"
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <FieldLabel>Retry Attempts</FieldLabel>
              <OsInput
                type="number"
                min={1}
                max={10}
                value={form.config.retryAttempts}
                onChange={(e) => updateConfig({ retryAttempts: Number(e.target.value) })}
              />
            </div>
            <div>
              <FieldLabel>Timeout (ms)</FieldLabel>
              <OsInput
                type="number"
                min={5000}
                max={120000}
                step={1000}
                value={form.config.timeout}
                onChange={(e) => updateConfig({ timeout: Number(e.target.value) })}
              />
            </div>
            <div className="sm:col-span-2">
              <FieldLabel>Ignore Specific Selectors</FieldLabel>
              <OsInput
                value={form.config.ignoreSelectors ?? ""}
                onChange={(e) => updateConfig({ ignoreSelectors: e.target.value })}
                placeholder=".cookie-banner, #promo-popup, .live-chat"
                className="font-mono text-sm"
              />
              <p className="mt-1.5 text-xs text-zinc-600">
                Comma-separated CSS selectors removed before comparison.
              </p>
            </div>
            {(form.mode === "CSS_SELECTOR" || form.mode === "XPATH" || form.selector) && (
              <div className="sm:col-span-2">
                <FieldLabel>{form.mode === "XPATH" ? "Page section path" : "Page section"}</FieldLabel>
                <OsInput
                  value={form.selector}
                  onChange={(e) => setForm({ ...form, selector: e.target.value })}
                  placeholder={form.mode === "XPATH" ? "//div[@class='price']" : ".product-price"}
                  className="font-mono text-sm"
                />
              </div>
            )}
          </div>
          <div className="mt-4 space-y-2">
            <ToggleRow
              label="Ignore Dynamic Content"
              description="Normalize volatile content like counters"
              checked={form.config.ignoreDynamicContent ?? true}
              onCheckedChange={(v) => updateConfig({ ignoreDynamicContent: v })}
            />
            <ToggleRow
              label="Ignore Timestamps"
              description="Ignore date/time strings that change frequently"
              checked={form.config.ignoreTimestamps ?? true}
              onCheckedChange={(v) => updateConfig({ ignoreTimestamps: v })}
            />
            <ToggleRow
              label="Ignore Ads"
              description="Remove advertisement elements before comparison"
              checked={form.config.ignoreAds ?? true}
              onCheckedChange={(v) => updateConfig({ ignoreAds: v })}
            />
            <ToggleRow
              label="Ignore Cookies"
              description="Strip cookie banners from comparison"
              checked={form.config.ignoreCookies ?? true}
              onCheckedChange={(v) => updateConfig({ ignoreCookies: v })}
            />
            <ToggleRow
              label="Ignore Random IDs"
              description="Filter dynamic element IDs and UUIDs"
              checked={form.config.ignoreRandomIds ?? true}
              onCheckedChange={(v) => updateConfig({ ignoreRandomIds: v })}
            />
            <ToggleRow
              label="Follow website access rules"
              description={
                form.mode === "VISUAL_CHANGES" || form.mode === "SCREENSHOT_DIFF"
                  ? "Usually leave off for visual checks on social sites"
                  : "Leave on unless the site blocks monitoring"
              }
              checked={form.respectRobots}
              onCheckedChange={(v) => setForm((prev) => ({ ...prev, respectRobots: v }))}
            />
          </div>
        </SettingsSection>

        {/* Notifications */}
        <SettingsSection
          id="notifications"
          title="Notifications"
          subtitle="Email alerts, frequency, and importance"
          icon={<Bell className="h-5 w-5" />}
          open={openSections.notifications}
          onToggle={() => toggleSection("notifications")}
          accent="from-emerald-500/10 to-cyan-500/5"
        >
          <div className="grid gap-2 sm:grid-cols-2">
            {(
              [
                { id: "EMAIL", label: "Email notifications", icon: Mail },
                { id: "TELEGRAM", label: "Telegram", icon: Send },
                { id: "BOTH", label: "Email & Telegram", icon: MessageCircle },
              ] as const
            ).map((channel) => {
              const Icon = channel.icon;
              const selected = form.notificationMethod === channel.id;
              return (
                <button
                  key={channel.id}
                  type="button"
                  onClick={() => setForm({ ...form, notificationMethod: channel.id })}
                  className={cn(
                    "flex items-center gap-3 rounded-lg border p-4 text-left transition-all",
                    selected
                      ? "border-emerald-500/40 bg-emerald-500/10"
                      : "border-white/[0.06] bg-black/20 hover:bg-white/[0.03]"
                  )}
                >
                  <Icon className={cn("h-5 w-5", selected ? "text-emerald-400" : "text-zinc-500")} />
                  <span className={cn("text-sm font-medium", selected ? "text-emerald-100" : "text-zinc-300")}>
                    {channel.label}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <FieldLabel>Notification Frequency</FieldLabel>
              <Select
                value={form.config.notificationFrequency ?? "INSTANT"}
                onValueChange={(v) =>
                  updateConfig({
                    notificationFrequency: v as MonitorConfig["notificationFrequency"],
                  })
                }
              >
                <SelectTrigger className="border-white/[0.08] bg-black/40 text-zinc-100">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="INSTANT">Instant — every qualifying change</SelectItem>
                  <SelectItem value="HOURLY">Hourly digest preference</SelectItem>
                  <SelectItem value="DAILY">Daily digest preference</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <FieldLabel>Importance Level</FieldLabel>
              <Select
                value={form.config.minImportance ?? "MEDIUM"}
                onValueChange={(v) =>
                  updateConfig({ minImportance: v as MonitorConfig["minImportance"] })
                }
              >
                <SelectTrigger className="border-white/[0.08] bg-black/40 text-zinc-100">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="LOW">Low and above</SelectItem>
                  <SelectItem value="MEDIUM">Medium and above</SelectItem>
                  <SelectItem value="HIGH">High and above</SelectItem>
                  <SelectItem value="CRITICAL">Critical only</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </SettingsSection>

        {/* Danger Zone */}
        <SettingsSection
          id="danger"
          title="Danger Zone"
          subtitle="Irreversible or disruptive actions"
          icon={<AlertTriangle className="h-5 w-5 text-red-400" />}
          open={openSections.danger}
          onToggle={() => toggleSection("danger")}
          accent="from-red-500/10 to-orange-500/5"
        >
          <div className="grid gap-3 sm:grid-cols-2">
            {[
              {
                label: "Pause Monitor",
                desc: "Stop checks without deleting data",
                icon: Pause,
                action: pauseMonitor,
                variant: "default" as const,
              },
              {
                label: "Reset History",
                desc: "Clear all changes and snapshots",
                icon: RotateCcw,
                action: resetHistory,
                variant: "default" as const,
              },
              {
                label: "Archive Monitor",
                desc: "Pause and mark as archived",
                icon: Archive,
                action: archiveMonitor,
                variant: "default" as const,
              },
              {
                label: "Delete Monitor",
                desc: "Permanently remove this monitor",
                icon: Trash2,
                action: deleteMonitor,
                variant: "danger" as const,
              },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.label}
                  type="button"
                  onClick={item.action}
                  className={`flex items-start gap-3 rounded-lg border p-4 text-left transition-colors ${
                    item.variant === "danger"
                      ? "border-red-500/30 bg-red-500/5 hover:bg-red-500/10"
                      : "border-white/[0.06] bg-black/20 hover:border-white/[0.12] hover:bg-white/[0.04]"
                  }`}
                >
                  <Icon
                    className={`mt-0.5 h-4 w-4 shrink-0 ${
                      item.variant === "danger" ? "text-red-400" : "text-zinc-400"
                    }`}
                  />
                  <div>
                    <p
                      className={`text-sm font-medium ${
                        item.variant === "danger" ? "text-red-300" : "text-zinc-200"
                      }`}
                    >
                      {item.label}
                    </p>
                    <p className="mt-0.5 text-xs text-zinc-500">{item.desc}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </SettingsSection>
      </div>

      {/* Recent Changes */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.15 }}
        className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5"
      >
        <div className="mb-4 flex items-center justify-between">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">Activity</p>
            <h2 className="text-lg font-medium text-zinc-100">Recent Changes</h2>
          </div>
          <span className="font-mono text-xs text-zinc-500">{monitor._count.changes} total</span>
        </div>
        {monitor.changes.length === 0 ? (
          <div className="rounded-lg border border-dashed border-white/[0.08] bg-black/20 px-4 py-8 text-center">
            <p className="text-sm font-medium text-zinc-300">No changes detected yet</p>
            <p className="mt-1 text-xs leading-relaxed text-zinc-500">
              Your monitor is active and watching your website.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {monitor.changes.map((change, i) => (
              <motion.div
                key={change.id}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
              >
                <Link
                  href={`/dashboard/changes/${change.id}`}
                  className="flex items-center justify-between gap-3 rounded-lg border border-white/[0.04] bg-black/20 px-4 py-3 transition-colors hover:border-cyan-500/20 hover:bg-cyan-500/[0.04]"
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <span>{change.emoji}</span>
                    <p className="truncate text-sm text-zinc-300">{change.summary}</p>
                  </div>
                  <span className="shrink-0 font-mono text-[10px] text-zinc-500">
                    {formatRelativeTime(change.createdAt)}
                  </span>
                </Link>
              </motion.div>
            ))}
          </div>
        )}
        {(monitor.lastCheckedAt || monitor.lastChangedAt) && (
          <div className="mt-4 flex flex-wrap gap-4 font-mono text-[10px] text-zinc-600">
            {monitor.lastCheckedAt && (
              <span>Last checked {formatRelativeTime(monitor.lastCheckedAt)}</span>
            )}
            {monitor.lastChangedAt && (
              <span>Last changed {formatRelativeTime(monitor.lastChangedAt)}</span>
            )}
          </div>
        )}
      </motion.div>
    </div>
  );
}
