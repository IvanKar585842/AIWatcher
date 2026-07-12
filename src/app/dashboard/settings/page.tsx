"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { UserProfile, useUser } from "@clerk/nextjs";
import {
  Activity,
  Bell,
  Bot,
  Clock,
  Copy,
  ExternalLink,
  Gift,
  Loader2,
  Lock,
  Monitor,
  Plug,
  Save,
  Shield,
  Trash2,
  Unlink,
  User,
} from "lucide-react";
import { MonitoringInterval, MonitoringMode, NotificationMethod } from "@prisma/client";
import { CommandPageHeader } from "@/components/dashboard/command/command-page-header";
import { OsExpandableSection, OsFieldLabel, OsInput } from "@/components/dashboard/os/os-primitives";
import { AgencyBadgeSettings } from "@/components/growth/agency-badge-settings";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { INTERVAL_LABELS, MODE_LABELS, NOTIFICATION_LABELS } from "@/lib/constants";
import { CREATE_AI_PROMPT_EXAMPLES } from "@/lib/monitor-config";
import {
  AI_PROVIDER_OPTIONS,
  DEFAULT_USER_SETTINGS,
  IMPORTANCE_OPTIONS,
  TIMEZONE_OPTIONS,
  loadUserSettings,
  saveUserSettings,
  type UserSettings,
} from "@/lib/user-settings";
import { useToast } from "@/components/ui/os-toast";
import { cn } from "@/lib/utils";

function SettingRow({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-white/[0.06] bg-black/30 px-4 py-3">
      <div className="min-w-0">
        <p className="text-sm text-zinc-200">{title}</p>
        {description && <p className="text-xs text-zinc-600">{description}</p>}
      </div>
      {children}
    </div>
  );
}

function OsSelectTrigger({ className, ...props }: React.ComponentProps<typeof SelectTrigger>) {
  return (
    <SelectTrigger
      {...props}
      className={cn(
        "w-full max-w-full border-white/[0.08] bg-black/50 text-zinc-100 sm:w-56",
        className
      )}
    />
  );
}

export default function SettingsPage() {
  const { user } = useUser();
  const { toast } = useToast();
  const [settings, setSettings] = useState<UserSettings>(DEFAULT_USER_SETTINGS);
  const [telegram, setTelegram] = useState<{
    linked: boolean;
    connected?: boolean;
    telegramUsername: string | null;
    linkUrl: string | null;
    email?: string;
    telegramNotificationsEnabled?: boolean;
    emailNotificationsEnabled?: boolean;
  } | null>(null);
  const [telegramLoading, setTelegramLoading] = useState(true);
  const [telegramError, setTelegramError] = useState(false);
  const [unlinking, setUnlinking] = useState(false);
  const [showAccountPanel, setShowAccountPanel] = useState(false);
  const [newTemplate, setNewTemplate] = useState("");

  const [statusUsername, setStatusUsername] = useState("");
  const [statusEnabled, setStatusEnabled] = useState(false);
  const [statusTitle, setStatusTitle] = useState("");
  const [statusMonitors, setStatusMonitors] = useState<
    Array<{ id: string; name: string; url: string; statusPageVisible: boolean }>
  >([]);
  const [statusLoading, setStatusLoading] = useState(true);
  const [statusSaving, setStatusSaving] = useState(false);
  const [publicUrl, setPublicUrl] = useState<string | null>(null);
  const [referral, setReferral] = useState<{
    code: string;
    inviteUrl: string;
    signups: number;
    note: string;
  } | null>(null);
  const [referralLoading, setReferralLoading] = useState(true);
  const [referralCopied, setReferralCopied] = useState(false);
  const [reportPrefs, setReportPrefs] = useState<{
    weeklyReportEnabled: boolean;
    reportFrequency: "WEEKLY" | "MONTHLY";
    reportType: "BUSINESS" | "DEVELOPER" | "SEO" | "COMPETITOR";
  } | null>(null);
  const [reportPrefsSaving, setReportPrefsSaving] = useState(false);

  useEffect(() => {
    setSettings(loadUserSettings());
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    type TelegramStatus = {
      linked: boolean;
      connected?: boolean;
      telegramUsername: string | null;
      linkUrl: string | null;
      email?: string;
      telegramNotificationsEnabled?: boolean;
      emailNotificationsEnabled?: boolean;
    };

    function applyTelegramData(data: TelegramStatus) {
      setTelegram(data);
      setTelegramError(false);
      setSettings((prev) => {
        const next = {
          ...prev,
          emailNotifications:
            typeof data.emailNotificationsEnabled === "boolean"
              ? data.emailNotificationsEnabled
              : prev.emailNotifications,
          telegramNotifications:
            typeof data.telegramNotificationsEnabled === "boolean"
              ? data.telegramNotificationsEnabled
              : prev.telegramNotifications,
        };
        saveUserSettings(next);
        return next;
      });
    }

    function loadTelegram(signal?: AbortSignal) {
      return fetch("/api/telegram/link", { signal })
        .then((r) => {
          if (!r.ok) throw new Error("Failed");
          return r.json();
        })
        .then((raw: Record<string, unknown>) => {
          applyTelegramData({
            linked: Boolean(raw.linked ?? raw.connected),
            connected: Boolean(raw.connected ?? raw.linked),
            telegramUsername:
              typeof raw.telegramUsername === "string" ? raw.telegramUsername : null,
            linkUrl: typeof raw.linkUrl === "string" ? raw.linkUrl : null,
            email: typeof raw.email === "string" ? raw.email : undefined,
            telegramNotificationsEnabled:
              typeof raw.telegramNotificationsEnabled === "boolean"
                ? raw.telegramNotificationsEnabled
                : undefined,
            emailNotificationsEnabled:
              typeof raw.emailNotificationsEnabled === "boolean"
                ? raw.emailNotificationsEnabled
                : undefined,
          });
        });
    }

    loadTelegram(controller.signal)
      .catch((err) => {
        if (err.name !== "AbortError") setTelegramError(true);
      })
      .finally(() => setTelegramLoading(false));

    // After Connect → Telegram Start, refresh status when user returns to this tab
    function refreshIfNeeded() {
      if (document.visibilityState !== "visible") return;
      void loadTelegram().catch(() => {
        /* keep last known status */
      });
    }

    window.addEventListener("focus", refreshIfNeeded);
    document.addEventListener("visibilitychange", refreshIfNeeded);

    return () => {
      controller.abort();
      window.removeEventListener("focus", refreshIfNeeded);
      document.removeEventListener("visibilitychange", refreshIfNeeded);
    };
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/user/status-page", { signal: controller.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        const data = json?.data;
        if (!data) return;
        setStatusUsername(data.username ?? "");
        setStatusEnabled(Boolean(data.statusPageEnabled));
        setStatusTitle(data.statusPageTitle ?? "");
        setPublicUrl(data.publicUrl);
        setStatusMonitors(data.monitors ?? []);
      })
      .catch(() => {})
      .finally(() => setStatusLoading(false));
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/user/referrals", { signal: controller.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!data?.referralCode) return;
        setReferral({
          code: data.referralCode,
          inviteUrl: data.inviteUrl,
          signups: data.referralStats?.signups ?? 0,
          note: data.note ?? "",
        });
      })
      .catch(() => {})
      .finally(() => setReferralLoading(false));
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/reports/preferences", { signal: controller.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!data) return;
        setReportPrefs({
          weeklyReportEnabled: Boolean(data.weeklyReportEnabled),
          reportFrequency: data.reportFrequency ?? "WEEKLY",
          reportType: data.reportType ?? "BUSINESS",
        });
      })
      .catch(() => {});
    return () => controller.abort();
  }, []);

  async function saveReportPrefs(
    patch: Partial<{
      weeklyReportEnabled: boolean;
      reportFrequency: "WEEKLY" | "MONTHLY";
      reportType: "BUSINESS" | "DEVELOPER" | "SEO" | "COMPETITOR";
    }>
  ) {
    if (!reportPrefs) return;
    const next = { ...reportPrefs, ...patch };
    setReportPrefs(next);
    setReportPrefsSaving(true);
    try {
      const res = await fetch("/api/reports/preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!res.ok) throw new Error("Failed");
      toast("Report preferences saved", "success");
      // keep local weeklySummary in sync for UI consistency
      if (typeof patch.weeklyReportEnabled === "boolean") {
        updateSettings({ weeklySummary: patch.weeklyReportEnabled });
      }
    } catch {
      toast("Could not save report preferences", "error");
    } finally {
      setReportPrefsSaving(false);
    }
  }

  async function copyReferralLink() {
    if (!referral?.inviteUrl) return;
    await navigator.clipboard.writeText(referral.inviteUrl);
    setReferralCopied(true);
    toast("Invite link copied", "success");
    window.setTimeout(() => setReferralCopied(false), 2000);
  }

  function updateSettings(patch: Partial<UserSettings>) {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      saveUserSettings(next);
      return next;
    });

    const serverPatch: {
      emailNotificationsEnabled?: boolean;
      telegramNotificationsEnabled?: boolean;
    } = {};
    if (typeof patch.emailNotifications === "boolean") {
      serverPatch.emailNotificationsEnabled = patch.emailNotifications;
    }
    if (typeof patch.telegramNotifications === "boolean") {
      serverPatch.telegramNotificationsEnabled = patch.telegramNotifications;
    }
    if (Object.keys(serverPatch).length > 0) {
      void fetch("/api/telegram/link", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(serverPatch),
      }).catch(() => {
        /* keep local toggle; server sync best-effort */
      });
    }
  }

  async function unlinkTelegram() {
    setUnlinking(true);
    await fetch("/api/telegram/link", { method: "DELETE" });
    const data = await fetch("/api/telegram/link").then((r) => r.json());
    setTelegram(data);
    setUnlinking(false);
  }

  function addTemplate() {
    const trimmed = newTemplate.trim();
    if (!trimmed || settings.aiPromptTemplates.includes(trimmed)) return;
    updateSettings({ aiPromptTemplates: [...settings.aiPromptTemplates, trimmed] });
    setNewTemplate("");
  }

  async function saveStatusPage() {
    setStatusSaving(true);
    try {
      const res = await fetch("/api/user/status-page", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: statusUsername.trim() ? statusUsername.trim().toLowerCase() : null,
          statusPageEnabled: statusEnabled,
          statusPageTitle: statusTitle.trim() || null,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast(json.error ?? "Could not save status page", "error");
        return;
      }
      setPublicUrl(json.data?.publicUrl ?? null);
      setStatusUsername(json.data?.username ?? "");
      setStatusEnabled(Boolean(json.data?.statusPageEnabled));
      toast("Status page settings saved", "success");
    } catch {
      toast("Could not save status page", "error");
    } finally {
      setStatusSaving(false);
    }
  }

  async function toggleMonitorVisibility(monitorId: string, visible: boolean) {
    setStatusMonitors((prev) =>
      prev.map((m) => (m.id === monitorId ? { ...m, statusPageVisible: visible } : m))
    );
    const res = await fetch("/api/user/status-page/monitors", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ monitorId, statusPageVisible: visible }),
    });
    if (!res.ok) {
      toast("Could not update monitor visibility", "error");
    }
  }

  function copyPublicUrl() {
    if (!publicUrl) return;
    const full = `${window.location.origin}${publicUrl}`;
    void navigator.clipboard.writeText(full);
    toast("Status page URL copied", "success");
  }

  return (
    <div className="space-y-6 p-4 lg:p-6">
      <CommandPageHeader
        label="System"
        title="Settings"
        description="Profile, notifications, monitoring defaults, AI, and account."
      />

      <div className="mx-auto max-w-3xl space-y-3">
        {/* Profile */}
        <OsExpandableSection
          title="Profile"
          subtitle="Identity and workspace appearance"
          icon={<User className="h-5 w-5" />}
          defaultOpen
        >
          <div className="space-y-4">
            <div>
              <OsFieldLabel>Display name</OsFieldLabel>
              <p className="rounded-lg border border-white/[0.06] bg-black/30 px-3 py-2 text-sm text-zinc-300">
                {user?.fullName ?? user?.firstName ?? "—"}
              </p>
            </div>
            <div>
              <OsFieldLabel>Email</OsFieldLabel>
              <p className="rounded-lg border border-white/[0.06] bg-black/30 px-3 py-2 text-sm text-zinc-300">
                {user?.primaryEmailAddress?.emailAddress ?? "—"}
              </p>
            </div>
            <SettingRow title="Compact dashboard layout" description="Reduce spacing in monitor grids">
              <Switch
                checked={settings.compactMode}
                onCheckedChange={(v) => updateSettings({ compactMode: v })}
                className="data-[state=checked]:bg-cyan-500"
              />
            </SettingRow>
            <SettingRow
              title="Usage analytics"
              description="Help improve WatchFlowing with anonymous usage data"
            >
              <Switch
                checked={settings.analyticsEnabled}
                onCheckedChange={(v) => updateSettings({ analyticsEnabled: v })}
                className="data-[state=checked]:bg-cyan-500"
              />
            </SettingRow>
          </div>
        </OsExpandableSection>

        {/* Notifications */}
        <OsExpandableSection
          title="Notifications"
          subtitle="Email, Telegram, and alert delivery"
          icon={<Bell className="h-5 w-5" />}
        >
          <div className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-white/[0.06] bg-black/20 p-4">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <p className="text-sm font-medium text-zinc-200">Email</p>
                  <Badge className="border-emerald-500/30 bg-emerald-500/10 text-emerald-300">
                    ✓ Connected
                  </Badge>
                </div>
                <p className="mb-3 truncate text-xs text-zinc-500">
                  {telegram?.email || user?.primaryEmailAddress?.emailAddress || "Account email"}
                </p>
                <SettingRow title="Email notifications" description="Receive alerts via email">
                  <Switch
                    checked={settings.emailNotifications}
                    onCheckedChange={(v) => updateSettings({ emailNotifications: v })}
                    className="data-[state=checked]:bg-cyan-500"
                  />
                </SettingRow>
              </div>

              <div className="rounded-xl border border-white/[0.06] bg-black/20 p-4">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-medium text-zinc-200">Telegram</p>
                  {telegramLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin text-cyan-400" />
                  ) : telegram?.linked || telegram?.connected ? (
                    <Badge className="border-emerald-500/30 bg-emerald-500/10 text-emerald-300">
                      ✓ Connected
                    </Badge>
                  ) : (
                    <Badge className="border-zinc-500/30 bg-zinc-500/10 text-zinc-400">
                      Not connected
                    </Badge>
                  )}
                </div>
                {(telegram?.linked || telegram?.connected) && telegram.telegramUsername ? (
                  <p className="mb-3 text-xs text-zinc-500">@{telegram.telegramUsername}</p>
                ) : (
                  <p className="mb-3 text-xs text-zinc-500">WatchFlowAlertsBot</p>
                )}
                <SettingRow
                  title="Telegram notifications"
                  description="Instant alerts through Telegram"
                >
                  <Switch
                    checked={settings.telegramNotifications}
                    onCheckedChange={(v) => updateSettings({ telegramNotifications: v })}
                    className="data-[state=checked]:bg-cyan-500"
                    disabled={!(telegram?.linked || telegram?.connected)}
                  />
                </SettingRow>
                <div className="mt-3 flex flex-wrap gap-2">
                  {telegramLoading ? null : telegramError ? (
                    <p className="text-sm text-red-400">Failed to load Telegram settings.</p>
                  ) : telegram?.linked || telegram?.connected ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={unlinkTelegram}
                      disabled={unlinking}
                      className="rounded-full border-white/[0.08] bg-transparent text-zinc-400 hover:text-red-300"
                    >
                      {unlinking ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Unlink className="mr-2 h-4 w-4" />
                      )}
                      Disconnect Telegram
                    </Button>
                  ) : telegram?.linkUrl ? (
                    <a href={telegram.linkUrl} target="_blank" rel="noopener noreferrer">
                      <Button
                        size="sm"
                        className="rounded-full bg-cyan-500 text-black hover:bg-cyan-400"
                      >
                        <ExternalLink className="mr-2 h-4 w-4" />
                        Connect Telegram
                      </Button>
                    </a>
                  ) : (
                    <p className="text-sm text-amber-400/90">
                      Telegram linking is not configured on this server.
                    </p>
                  )}
                </div>
              </div>
            </div>

            <SettingRow
              title="Weekly AI report"
              description="Monday intelligence digest via email / Telegram"
            >
              <Switch
                checked={reportPrefs?.weeklyReportEnabled ?? settings.weeklySummary}
                disabled={!reportPrefs || reportPrefsSaving}
                onCheckedChange={(v) => void saveReportPrefs({ weeklyReportEnabled: v })}
                className="data-[state=checked]:bg-cyan-500"
              />
            </SettingRow>

            {reportPrefs && (
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <OsFieldLabel>Report type</OsFieldLabel>
                  <select
                    value={reportPrefs.reportType}
                    disabled={reportPrefsSaving}
                    onChange={(e) =>
                      void saveReportPrefs({
                        reportType: e.target.value as typeof reportPrefs.reportType,
                      })
                    }
                    className="h-11 w-full rounded-xl border border-white/[0.08] bg-black/40 px-3 text-sm text-zinc-200"
                  >
                    <option value="BUSINESS">Business</option>
                    <option value="DEVELOPER">Developer</option>
                    <option value="SEO">SEO</option>
                    <option value="COMPETITOR">Competitor</option>
                  </select>
                </div>
                <div>
                  <OsFieldLabel>Frequency</OsFieldLabel>
                  <select
                    value={reportPrefs.reportFrequency}
                    disabled={reportPrefsSaving}
                    onChange={(e) =>
                      void saveReportPrefs({
                        reportFrequency: e.target
                          .value as typeof reportPrefs.reportFrequency,
                      })
                    }
                    className="h-11 w-full rounded-xl border border-white/[0.08] bg-black/40 px-3 text-sm text-zinc-200"
                  >
                    <option value="WEEKLY">Weekly</option>
                    <option value="MONTHLY">Monthly</option>
                  </select>
                </div>
              </div>
            )}

            <SettingRow title="Instant alerts" description="Notify immediately on important changes">
              <Switch
                checked={settings.instantAlerts}
                onCheckedChange={(v) => updateSettings({ instantAlerts: v })}
                className="data-[state=checked]:bg-cyan-500"
              />
            </SettingRow>
          </div>
        </OsExpandableSection>

        {/* Monitoring preferences */}
        <OsExpandableSection
          title="Monitoring preferences"
          subtitle="Defaults applied when creating new monitors"
          icon={<Monitor className="h-5 w-5" />}
        >
          <div className="space-y-4">
            <div>
              <OsFieldLabel>Default interval</OsFieldLabel>
              <Select
                value={settings.defaultInterval}
                onValueChange={(v) =>
                  updateSettings({ defaultInterval: v as MonitoringInterval })
                }
              >
                <OsSelectTrigger>
                  <SelectValue />
                </OsSelectTrigger>
                <SelectContent>
                  {Object.entries(INTERVAL_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <OsFieldLabel>Default monitoring mode</OsFieldLabel>
              <Select
                value={settings.defaultMode}
                onValueChange={(v) => updateSettings({ defaultMode: v as MonitoringMode })}
              >
                <OsSelectTrigger>
                  <SelectValue />
                </OsSelectTrigger>
                <SelectContent>
                  {Object.entries(MODE_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <OsFieldLabel>Timezone</OsFieldLabel>
              <Select
                value={settings.timezone}
                onValueChange={(v) => updateSettings({ timezone: v })}
              >
                <OsSelectTrigger>
                  <SelectValue />
                </OsSelectTrigger>
                <SelectContent>
                  {TIMEZONE_OPTIONS.map((tz) => (
                    <SelectItem key={tz} value={tz}>
                      {tz}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <OsFieldLabel>Default notification method</OsFieldLabel>
              <Select
                value={settings.defaultNotificationMethod}
                onValueChange={(v) =>
                  updateSettings({ defaultNotificationMethod: v as NotificationMethod })
                }
              >
                <OsSelectTrigger>
                  <SelectValue />
                </OsSelectTrigger>
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
        </OsExpandableSection>

        {/* AI preferences */}
        <OsExpandableSection
          title="AI preferences"
          subtitle="Provider, templates, and analysis thresholds"
          icon={<Bot className="h-5 w-5" />}
        >
          <div className="space-y-4">
            <div>
              <OsFieldLabel>Default AI provider</OsFieldLabel>
              <Select
                value={settings.aiProvider}
                onValueChange={(v) =>
                  updateSettings({ aiProvider: v as UserSettings["aiProvider"] })
                }
              >
                <OsSelectTrigger>
                  <SelectValue />
                </OsSelectTrigger>
                <SelectContent>
                  {AI_PROVIDER_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="mt-2 text-xs text-zinc-600">
                Server override via <code className="text-cyan-400/80">AI_PROVIDER</code> takes
                precedence when set.
              </p>
            </div>

            <div>
              <OsFieldLabel>Importance threshold</OsFieldLabel>
              <Select
                value={settings.importanceThreshold}
                onValueChange={(v) =>
                  updateSettings({ importanceThreshold: v as UserSettings["importanceThreshold"] })
                }
              >
                <OsSelectTrigger>
                  <SelectValue />
                </OsSelectTrigger>
                <SelectContent>
                  {IMPORTANCE_OPTIONS.map((imp) => (
                    <SelectItem key={imp} value={imp}>
                      {imp} and above
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <SettingRow
              title="Ignore cosmetic changes"
              description="Filter layout-only and styling noise"
            >
              <Switch
                checked={settings.ignoreCosmeticChanges}
                onCheckedChange={(v) => updateSettings({ ignoreCosmeticChanges: v })}
                className="data-[state=checked]:bg-cyan-500"
              />
            </SettingRow>

            <div>
              <OsFieldLabel>AI prompt templates</OsFieldLabel>
              <div className="flex flex-wrap gap-1.5">
                {[...CREATE_AI_PROMPT_EXAMPLES, ...settings.aiPromptTemplates].map((tpl) => (
                  <span
                    key={tpl}
                    className="rounded-full border border-white/[0.08] bg-black/30 px-2.5 py-1 text-[10px] text-zinc-500"
                  >
                    {tpl}
                  </span>
                ))}
              </div>
              <div className="mt-3 flex gap-2">
                <input
                  value={newTemplate}
                  onChange={(e) => setNewTemplate(e.target.value)}
                  placeholder="Add a custom template..."
                  className="flex-1 rounded-lg border border-white/[0.08] bg-black/50 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/40"
                  onKeyDown={(e) => e.key === "Enter" && addTemplate()}
                />
                <Button
                  type="button"
                  size="sm"
                  onClick={addTemplate}
                  className="rounded-full bg-cyan-500/15 text-cyan-200 hover:bg-cyan-500/25"
                >
                  Add
                </Button>
              </div>
            </div>
          </div>
        </OsExpandableSection>

        {/* Integrations */}
        <OsExpandableSection
          title="Integrations"
          subtitle="Channels, apps, and public status"
          icon={<Plug className="h-5 w-5" />}
        >
          <div className="space-y-4">
            <Link
              href="/dashboard/integrations"
              className="flex items-center justify-between rounded-xl border border-white/[0.06] bg-black/20 px-4 py-3 transition-colors hover:border-cyan-500/25"
            >
              <div>
                <p className="text-sm text-zinc-200">Browse integrations</p>
                <p className="text-xs text-zinc-500">Email is active · more channels coming soon</p>
              </div>
              <ExternalLink className="h-4 w-4 text-zinc-500" />
            </Link>

            <div className="rounded-xl border border-white/[0.06] bg-black/20 p-4">
              <div className="mb-4 flex items-center gap-2">
                <Activity className="h-4 w-4 text-cyan-400" />
                <p className="text-sm font-medium text-zinc-200">Public status page</p>
              </div>

              {statusLoading ? (
                <Loader2 className="h-5 w-5 animate-spin text-cyan-400" />
              ) : (
                <div className="space-y-4">
                  <SettingRow
                    title="Enable public status page"
                  description="Share a client-ready reliability page at /status/your-username"
                  >
                    <Switch
                      checked={statusEnabled}
                      onCheckedChange={setStatusEnabled}
                      className="data-[state=checked]:bg-cyan-500"
                    />
                  </SettingRow>

                  <div>
                    <OsFieldLabel>Username</OsFieldLabel>
                    <div className="flex items-center gap-2">
                      <span className="shrink-0 text-xs text-zinc-600">/status/</span>
                      <OsInput
                        value={statusUsername}
                        onChange={(e) => setStatusUsername(e.target.value.toLowerCase())}
                        placeholder="acme"
                        className="font-mono"
                      />
                    </div>
                  </div>

                  <div>
                    <OsFieldLabel>Page title (optional)</OsFieldLabel>
                    <OsInput
                      value={statusTitle}
                      onChange={(e) => setStatusTitle(e.target.value)}
                      placeholder="Acme status"
                    />
                  </div>

                  {publicUrl && statusEnabled && (
                    <div className="flex flex-wrap items-center gap-2">
                      <a
                        href={publicUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-cyan-400 hover:text-cyan-300"
                      >
                        {publicUrl}
                      </a>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={copyPublicUrl}
                        className="h-8 rounded-full border-white/[0.08] bg-transparent text-zinc-400"
                      >
                        <Copy className="mr-1.5 h-3.5 w-3.5" />
                        Copy
                      </Button>
                    </div>
                  )}

                  {statusMonitors.length > 0 && (
                    <div>
                      <p className="mb-2 text-xs text-zinc-500">Monitors on status page</p>
                      <div className="space-y-2">
                        {statusMonitors.map((m) => (
                          <SettingRow key={m.id} title={m.name} description={m.url}>
                            <Switch
                              checked={m.statusPageVisible}
                              onCheckedChange={(v) => toggleMonitorVisibility(m.id, v)}
                              className="data-[state=checked]:bg-cyan-500"
                            />
                          </SettingRow>
                        ))}
                      </div>
                    </div>
                  )}

                  <Button
                    type="button"
                    onClick={saveStatusPage}
                    disabled={statusSaving}
                    className="rounded-full bg-cyan-500 text-black hover:bg-cyan-400"
                  >
                    {statusSaving ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="mr-2 h-4 w-4" />
                    )}
                    Save status page
                  </Button>
                </div>
              )}
            </div>
          </div>
        </OsExpandableSection>

        <OsExpandableSection
          title="Invite & referrals"
          subtitle="Share WatchFlowing with teams and clients"
          icon={<Gift className="h-5 w-5" />}
        >
          <div className="space-y-4">
            <p className="text-sm leading-relaxed text-zinc-500">
              Share your invite link. Each signup gives you +1 monitor slot; new users get 7 days of
              Pro. No spammy popups — just a quiet growth loop.
            </p>
            {referralLoading ? (
              <Loader2 className="h-5 w-5 animate-spin text-cyan-400" />
            ) : referral ? (
              <div className="rounded-xl border border-white/[0.06] bg-black/20 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-mono text-[10px] uppercase tracking-widest text-zinc-600">
                      Your referral code
                    </p>
                    <p className="mt-1 font-mono text-lg text-cyan-200">{referral.code}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-mono text-[10px] uppercase tracking-widest text-zinc-600">
                      Referral count
                    </p>
                    <p className="mt-1 font-mono text-lg text-zinc-100">{referral.signups}</p>
                  </div>
                </div>
                <p className="mt-3 break-all font-mono text-[11px] text-zinc-500">
                  {referral.inviteUrl}
                </p>
                <Button
                  type="button"
                  onClick={() => void copyReferralLink()}
                  className="mt-4 min-h-11 rounded-full border border-cyan-400/30 bg-cyan-500/15 text-cyan-100 hover:bg-cyan-500/25"
                  variant="outline"
                >
                  <Copy className="mr-2 h-4 w-4" />
                  {referralCopied ? "Copied" : "Copy invite link"}
                </Button>
                {referral.note && (
                  <p className="mt-3 text-xs text-zinc-600">{referral.note}</p>
                )}
              </div>
            ) : (
              <p className="text-sm text-zinc-500">Could not load referral details.</p>
            )}
          </div>
        </OsExpandableSection>

        <OsExpandableSection
          title="Agency & badge"
          subtitle="Client-ready branding and embeddable trust badge"
          icon={<Plug className="h-5 w-5" />}
        >
          <AgencyBadgeSettings />
        </OsExpandableSection>

        {/* Account */}
        <OsExpandableSection
          title="Account"
          subtitle="Security, sessions, and authentication"
          icon={<Shield className="h-5 w-5" />}
        >
          <div className="space-y-3">
            <SettingRow title="Active sessions" description="Managed via your account provider">
              <Clock className="h-4 w-4 text-zinc-600" />
            </SettingRow>
            <SettingRow title="Two-factor authentication" description="Enable in account manager">
              <Lock className="h-4 w-4 text-zinc-600" />
            </SettingRow>
            <p className="text-sm text-zinc-500">
              Password, email, 2FA, and sessions are managed through your account provider.
            </p>
            <Button
              variant="outline"
              onClick={() => setShowAccountPanel(!showAccountPanel)}
              className="rounded-full border-white/[0.08] bg-white/[0.02] text-zinc-300 hover:border-cyan-500/30"
            >
              {showAccountPanel ? "Hide account manager" : "Manage account"}
            </Button>
            {showAccountPanel && (
              <div className="mt-2 overflow-hidden rounded-xl border border-white/[0.06]">
                <UserProfile
                  appearance={{
                    elements: {
                      rootBox: "w-full",
                      card: "bg-[#0a0a0a] border-0 shadow-none",
                    },
                  }}
                />
              </div>
            )}
          </div>
        </OsExpandableSection>

        <OsExpandableSection
          title="Danger Zone"
          subtitle="Irreversible account actions"
          icon={<Trash2 className="h-5 w-5" />}
          danger
        >
          <p className="mb-4 text-sm text-zinc-500">
            Deleting your account permanently removes all monitors, history, and notifications.
          </p>
          <Button
            variant="outline"
            disabled
            className="rounded-full border-red-500/30 bg-red-500/5 text-red-400 hover:bg-red-500/10"
          >
            Delete account
          </Button>
          <p className="mt-2 text-xs text-zinc-600">Contact support to request account deletion.</p>
        </OsExpandableSection>
      </div>
    </div>
  );
}
