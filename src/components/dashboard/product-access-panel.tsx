"use client";

import { useCallback, useEffect, useState } from "react";
import { KeyRound, Users, Webhook } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { OsExpandableSection } from "@/components/dashboard/os/os-primitives";

interface AccessState {
  schedule: { label: string; detail: string };
  alerts: Array<{ channel: string; ready: boolean; detail: string }>;
  webhook: { configured: boolean; url: string | null; allowed: boolean };
  api: { allowed: boolean; keys: Array<{ id: string; name: string; prefix: string }> };
  team: {
    allowed: boolean;
    limit: number;
    current: { name: string; role: string; memberCount: number; sharedMonitors: number } | null;
  };
}

export function ProductAccessPanel() {
  const [access, setAccess] = useState<AccessState | null>(null);
  const [webhookUrl, setWebhookUrl] = useState("");
  const [teamName, setTeamName] = useState("Team");
  const [keyName, setKeyName] = useState("Production");
  const [inviteCode, setInviteCode] = useState("");
  const [secret, setSecret] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const response = await fetch("/api/user/access");
    if (!response.ok) return;
    const data = (await response.json()) as AccessState;
    setAccess(data);
    if (data.webhook.url) setWebhookUrl(data.webhook.url);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  async function send(url: string, method: string, body?: unknown) {
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch(url, {
        method,
        headers: body ? { "Content-Type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setMessage(typeof data.error === "string" ? data.error : "That action was rejected");
        return data;
      }
      if (typeof data.secret === "string") setSecret(data.secret);
      if (typeof data.token === "string") setToken(data.token);
      if (typeof data.code === "string") setSecret(data.code);
      await load();
      return data;
    } finally {
      setBusy(false);
    }
  }

  return (
    <OsExpandableSection
      title="API, webhooks, and team"
      subtitle="Business delivery and shared monitors"
      icon={<Webhook className="h-5 w-5" />}
      defaultOpen
    >
      <div className="space-y-4 text-sm text-zinc-300">
        {access && (
          <p>
            Automatic checks on this server: <span className="text-cyan-100">{access.schedule.label}</span>.{" "}
            {access.schedule.detail}
          </p>
        )}
        <ul className="space-y-1">
          {(access?.alerts ?? []).map((alert) => (
            <li key={alert.channel}>
              <span className={alert.ready ? "text-emerald-300" : "text-amber-200"}>{alert.channel}</span>
              {" — "}
              {alert.detail}
            </li>
          ))}
        </ul>

        <div className="space-y-2 rounded-xl border border-white/[0.06] p-3">
          <p className="font-medium text-zinc-100">Webhook</p>
          <Input value={webhookUrl} onChange={(event) => setWebhookUrl(event.target.value)} placeholder="https://example.com/hooks/watchflowing" />
          <div className="flex flex-wrap gap-2">
            <Button type="button" disabled={busy || !access?.webhook.allowed} onClick={() => void send("/api/user/webhook", "PUT", { url: webhookUrl })}>
              Save endpoint
            </Button>
            <Button type="button" variant="outline" disabled={busy || !access?.webhook.configured} onClick={() => void send("/api/user/webhook", "DELETE")}>
              Remove
            </Button>
          </div>
        </div>

        <div className="space-y-2 rounded-xl border border-white/[0.06] p-3">
          <p className="flex items-center gap-2 font-medium text-zinc-100">
            <KeyRound className="h-4 w-4" /> API keys
          </p>
          <Input value={keyName} onChange={(event) => setKeyName(event.target.value)} />
          <Button type="button" disabled={busy || !access?.api.allowed} onClick={() => void send("/api/user/api-keys", "POST", { name: keyName })}>
            Create key
          </Button>
          <ul>
            {(access?.api.keys ?? []).map((key) => (
              <li key={key.id} className="mt-2 flex items-center justify-between gap-2">
                <span>{key.name} · {key.prefix}…</span>
                <Button type="button" variant="outline" disabled={busy} onClick={() => void send(`/api/user/api-keys/${key.id}`, "DELETE")}>
                  Revoke
                </Button>
              </li>
            ))}
          </ul>
          {token && <p className="break-all text-cyan-100">Copy this key now. It is not shown again: {token}</p>}
        </div>

        <div className="space-y-2 rounded-xl border border-white/[0.06] p-3">
          <p className="flex items-center gap-2 font-medium text-zinc-100">
            <Users className="h-4 w-4" /> Team
          </p>
          {access?.team.current ? (
            <p>
              {access.team.current.name} · {access.team.current.role} · {access.team.current.memberCount}/
              {access.team.limit} members · {access.team.current.sharedMonitors} shared monitors
            </p>
          ) : (
            <Input value={teamName} onChange={(event) => setTeamName(event.target.value)} />
          )}
          <div className="flex flex-wrap gap-2">
            <Button type="button" disabled={busy || !access?.team.allowed} onClick={() => void send("/api/teams", "POST", { name: teamName })}>
              Create team
            </Button>
            <Button type="button" variant="outline" disabled={busy || access?.team.current?.role !== "OWNER"} onClick={() => void send("/api/teams/invites", "POST")}>
              Create invite
            </Button>
            <Button type="button" variant="outline" disabled={busy || access?.team.current?.role !== "OWNER"} onClick={() => void send("/api/teams/share", "POST", { enabled: true })}>
              Share my monitors
            </Button>
          </div>
          <Input value={inviteCode} onChange={(event) => setInviteCode(event.target.value)} placeholder="Invite code" />
          <Button type="button" variant="outline" disabled={busy} onClick={() => void send("/api/teams/join", "POST", { code: inviteCode })}>
            Join with code
          </Button>
        </div>

        {secret && <p className="break-all text-cyan-100">Copy this secret now. It is not shown again: {secret}</p>}
        {message && <p className="text-amber-200">{message}</p>}
      </div>
    </OsExpandableSection>
  );
}
