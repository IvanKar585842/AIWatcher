"use client";

import { useEffect, useState } from "react";
import { UserProfile, useUser } from "@clerk/nextjs";
import {
  Bell,
  Bot,
  Clock,
  ExternalLink,
  Eye,
  Globe,
  Loader2,
  Lock,
  Monitor,
  Palette,
  Shield,
  Trash2,
  Unlink,
  User,
} from "lucide-react";
import { MonitoringInterval, MonitoringMode, NotificationMethod } from "@prisma/client";
import { CommandPageHeader } from "@/components/dashboard/command/command-page-header";
import { OsExpandableSection, OsFieldLabel } from "@/components/dashboard/os/os-primitives";
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
        "w-full min-w-[180px] border-white/[0.08] bg-black/50 text-zinc-100 sm:w-56",
        className
      )}
    />
  );
}

export default function SettingsPage() {
  const { user } = useUser();
  const [settings, setSettings] = useState<UserSettings>(DEFAULT_USER_SETTINGS);
  const [telegram, setTelegram] = useState<{
    linked: boolean;
    telegramUsername: string | null;
    linkUrl: string | null;
  } | null>(null);
  const [telegramLoading, setTelegramLoading] = useState(true);
  const [telegramError, setTelegramError] = useState(false);
  const [unlinking, setUnlinking] = useState(false);
  const [showAccountPanel, setShowAccountPanel] = useState(false);
  const [newTemplate, setNewTemplate] = useState("");

  useEffect(() => {
    setSettings(loadUserSettings());
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/telegram/link", { signal: controller.signal })
      .then((r) => {
        if (!r.ok) throw new Error("Failed");
        return r.json();
      })
      .then(setTelegram)
      .catch((err) => {
        if (err.name !== "AbortError") setTelegramError(true);
      })
      .finally(() => setTelegramLoading(false));
    return () => controller.abort();
  }, []);

  function updateSettings(patch: Partial<UserSettings>) {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      saveUserSettings(next);
      return next;
    });
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

  return (
    <div className="space-y-6 p-4 lg:p-6">
      <CommandPageHeader
        label="System"
        title="Settings"
        description="Configure your workspace, integrations, and preferences."
      />

      <div className="mx-auto max-w-3xl space-y-3">
        <OsExpandableSection
          title="General"
          subtitle="Workspace identity and locale"
          icon={<Globe className="h-5 w-5" />}
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
          </div>
        </OsExpandableSection>

        <OsExpandableSection
          title="Notifications"
          subtitle="Email, Telegram, and alert delivery"
          icon={<Bell className="h-5 w-5" />}
        >
          <div className="space-y-3">
            <SettingRow title="Email notifications" description="Receive alerts via email">
              <Switch
                checked={settings.emailNotifications}
                onCheckedChange={(v) => updateSettings({ emailNotifications: v })}
                className="data-[state=checked]:bg-cyan-500"
              />
            </SettingRow>
            <SettingRow title="Telegram notifications" description="Instant alerts through Telegram">
              <Switch
                checked={settings.telegramNotifications}
                onCheckedChange={(v) => updateSettings({ telegramNotifications: v })}
                className="data-[state=checked]:bg-cyan-500"
              />
            </SettingRow>
            <SettingRow title="Weekly summary" description="Digest of all detected changes">
              <Switch
                checked={settings.weeklySummary}
                onCheckedChange={(v) => updateSettings({ weeklySummary: v })}
                className="data-[state=checked]:bg-cyan-500"
              />
            </SettingRow>
            <SettingRow title="Instant alerts" description="Notify immediately on important changes">
              <Switch
                checked={settings.instantAlerts}
                onCheckedChange={(v) => updateSettings({ instantAlerts: v })}
                className="data-[state=checked]:bg-cyan-500"
              />
            </SettingRow>

            <div className="rounded-xl border border-white/[0.06] bg-black/20 p-4">
              <p className="mb-3 text-sm font-medium text-zinc-200">Telegram connection</p>
              {telegramLoading ? (
                <Loader2 className="h-5 w-5 animate-spin text-cyan-400" />
              ) : telegramError ? (
                <p className="text-sm text-red-400">Failed to load Telegram settings.</p>
              ) : telegram?.linked ? (
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <Badge className="border-emerald-500/30 bg-emerald-500/10 text-emerald-300">
                      Connected
                    </Badge>
                    {telegram.telegramUsername && (
                      <span className="text-sm text-zinc-400">@{telegram.telegramUsername}</span>
                    )}
                  </div>
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
                    Disconnect
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-sm text-zinc-500">
                    Connect Telegram for instant change alerts and bot commands.
                  </p>
                  {telegram?.linkUrl ? (
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
              )}
            </div>
          </div>
        </OsExpandableSection>

        <OsExpandableSection
          title="AI"
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

        <OsExpandableSection
          title="Appearance"
          subtitle="Visual preferences for the command center"
          icon={<Palette className="h-5 w-5" />}
        >
          <SettingRow title="Compact dashboard layout" description="Reduce spacing in monitor grids">
            <Switch
              checked={settings.compactMode}
              onCheckedChange={(v) => updateSettings({ compactMode: v })}
              className="data-[state=checked]:bg-cyan-500"
            />
          </SettingRow>
        </OsExpandableSection>

        <OsExpandableSection
          title="Monitoring Defaults"
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

        <OsExpandableSection
          title="Privacy"
          subtitle="Data collection and visibility"
          icon={<Eye className="h-5 w-5" />}
        >
          <SettingRow
            title="Usage analytics"
            description="Help improve WatchFlow with anonymous usage data"
          >
            <Switch
              checked={settings.analyticsEnabled}
              onCheckedChange={(v) => updateSettings({ analyticsEnabled: v })}
              className="data-[state=checked]:bg-cyan-500"
            />
          </SettingRow>
          <p className="text-xs leading-relaxed text-zinc-600">
            Monitor URLs and change history are stored securely and never shared with third parties.
          </p>
        </OsExpandableSection>

        <OsExpandableSection
          title="Security"
          subtitle="Sessions, passwords, and two-factor auth"
          icon={<Shield className="h-5 w-5" />}
        >
          <div className="space-y-3">
            <SettingRow title="Active sessions" description="Managed via your account provider">
              <Clock className="h-4 w-4 text-zinc-600" />
            </SettingRow>
            <SettingRow title="Two-factor authentication" description="Enable in Account settings">
              <Lock className="h-4 w-4 text-zinc-600" />
            </SettingRow>
            <p className="text-sm text-zinc-500">
              Security settings are managed through your account provider. Use the Account section
              below to update password, enable 2FA, and review active sessions.
            </p>
          </div>
        </OsExpandableSection>

        <OsExpandableSection
          title="Account"
          subtitle="Profile, email, and authentication"
          icon={<User className="h-5 w-5" />}
        >
          <Button
            variant="outline"
            onClick={() => setShowAccountPanel(!showAccountPanel)}
            className="rounded-full border-white/[0.08] bg-white/[0.02] text-zinc-300 hover:border-cyan-500/30"
          >
            {showAccountPanel ? "Hide account manager" : "Manage account"}
          </Button>
          {showAccountPanel && (
            <div className="mt-4 overflow-hidden rounded-xl border border-white/[0.06]">
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
