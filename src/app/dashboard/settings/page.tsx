"use client";

import { useEffect, useState } from "react";
import { UserProfile, useUser } from "@clerk/nextjs";
import {
  Bell,
  Bot,
  ExternalLink,
  Globe,
  Loader2,
  Monitor,
  Palette,
  Shield,
  Trash2,
  Unlink,
  User,
} from "lucide-react";
import { CommandPageHeader } from "@/components/dashboard/command/command-page-header";
import { OsExpandableSection, OsFieldLabel } from "@/components/dashboard/os/os-primitives";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";

export default function SettingsPage() {
  const { user } = useUser();
  const [telegram, setTelegram] = useState<{
    linked: boolean;
    telegramUsername: string | null;
    linkUrl: string | null;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [unlinking, setUnlinking] = useState(false);
  const [compactMode, setCompactMode] = useState(false);
  const [emailDigest, setEmailDigest] = useState(true);
  const [showAccountPanel, setShowAccountPanel] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/telegram/link", { signal: controller.signal })
      .then((r) => {
        if (!r.ok) throw new Error("Failed");
        return r.json();
      })
      .then(setTelegram)
      .catch((err) => {
        if (err.name !== "AbortError") setError(true);
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, []);

  async function unlinkTelegram() {
    setUnlinking(true);
    await fetch("/api/telegram/link", { method: "DELETE" });
    const data = await fetch("/api/telegram/link").then((r) => r.json());
    setTelegram(data);
    setUnlinking(false);
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
          subtitle="Workspace name and default behavior"
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
          title="Appearance"
          subtitle="Visual preferences for the command center"
          icon={<Palette className="h-5 w-5" />}
        >
          <div className="flex items-center justify-between rounded-lg border border-white/[0.06] bg-black/30 px-4 py-3">
            <div>
              <p className="text-sm text-zinc-200">Compact dashboard layout</p>
              <p className="text-xs text-zinc-600">Reduce spacing in monitor grids</p>
            </div>
            <Switch
              checked={compactMode}
              onCheckedChange={setCompactMode}
              className="data-[state=checked]:bg-cyan-500"
            />
          </div>
        </OsExpandableSection>

        <OsExpandableSection
          title="Notifications"
          subtitle="Telegram, email, and alert preferences"
          icon={<Bell className="h-5 w-5" />}
        >
          <div className="space-y-4">
            <div className="flex items-center justify-between rounded-lg border border-white/[0.06] bg-black/30 px-4 py-3">
              <div>
                <p className="text-sm text-zinc-200">Weekly email digest</p>
                <p className="text-xs text-zinc-600">Summary of detected changes</p>
              </div>
              <Switch
                checked={emailDigest}
                onCheckedChange={setEmailDigest}
                className="data-[state=checked]:bg-cyan-500"
              />
            </div>

            <div className="rounded-xl border border-white/[0.06] bg-black/20 p-4">
              <p className="mb-3 text-sm font-medium text-zinc-200">Telegram Integration</p>
              {loading ? (
                <Loader2 className="h-5 w-5 animate-spin text-cyan-400" />
              ) : error ? (
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

              <div className="mt-4 space-y-1 rounded-lg border border-white/[0.04] bg-black/30 p-3 font-mono text-xs text-zinc-600">
                <p className="text-zinc-400">/list · /pause · /resume · /delete · /latest</p>
              </div>
            </div>
          </div>
        </OsExpandableSection>

        <OsExpandableSection
          title="AI Settings"
          subtitle="Provider and analysis preferences"
          icon={<Bot className="h-5 w-5" />}
        >
          <p className="text-sm leading-relaxed text-zinc-500">
            The AI provider is configured server-side via{" "}
            <code className="rounded bg-white/[0.06] px-1.5 py-0.5 font-mono text-xs text-cyan-400/80">
              AI_PROVIDER
            </code>
            . Supported: OpenAI, Claude, Gemini.
          </p>
          <p className="mt-3 text-sm text-zinc-600">
            Per-monitor AI prompts can be configured when creating or editing a monitor.
          </p>
        </OsExpandableSection>

        <OsExpandableSection
          title="Monitoring"
          subtitle="Default check intervals and detection"
          icon={<Monitor className="h-5 w-5" />}
        >
          <p className="text-sm text-zinc-500">
            Default monitoring behavior respects robots.txt and uses smart diff filtering.
            Configure per-monitor settings from the monitor detail page.
          </p>
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
          title="Security"
          subtitle="Sessions, passwords, and two-factor auth"
          icon={<Shield className="h-5 w-5" />}
        >
          <p className="text-sm text-zinc-500">
            Security settings are managed through your account provider. Use the Account section
            above to update password, enable 2FA, and review active sessions.
          </p>
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
