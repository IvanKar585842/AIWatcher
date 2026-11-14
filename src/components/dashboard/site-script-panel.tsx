"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

type Signal = { id: string; kind: string; message: string; selector: string | null };
type Installation = { active: boolean; prefix: string | null; signals: Signal[] };

export function SiteScriptPanel({ monitorId }: { monitorId: string }) {
  const [installation, setInstallation] = useState<Installation | null>(null);
  const [snippet, setSnippet] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const response = await fetch(`/api/monitors/${monitorId}/site-token`);
    const data = await response.json().catch(() => ({}));
    if (response.status === 404 || response.status === 503) {
      setInstallation(null);
      if (response.status === 503) setMessage("Site script is unavailable until the database migration is applied.");
      return;
    }
    if (!response.ok) return;
    setInstallation(data.installation as Installation);
  }, [monitorId]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  async function issue() {
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch(`/api/monitors/${monitorId}/site-token`, { method: "POST" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setMessage(typeof data.error === "string" ? data.error : "Could not create the site key");
        return;
      }
      setSnippet(typeof data.snippet === "string" ? data.snippet : null);
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function revoke() {
    setBusy(true);
    setMessage(null);
    setSnippet(null);
    try {
      const response = await fetch(`/api/monitors/${monitorId}/site-token`, { method: "DELETE" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setMessage(typeof data.error === "string" ? data.error : "Could not revoke the site key");
        return;
      }
      await load();
    } finally {
      setBusy(false);
    }
  }

  if (!installation && !message) return null;

  return (
    <section className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5">
      <p className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">First-party script</p>
      <h2 className="text-lg font-medium text-zinc-100">Site script</h2>
      <p className="mt-1 text-sm text-zinc-400">
        Paste this into the site you own, before the closing head or body tag. It still reports
        when a bot check blocks the outside look, because it runs as part of your page. It
        reports JavaScript errors and, if you add data-watch, whether those elements are still
        there. It does not read forms, cookies, or page text, and it does not turn the bot check off.
      </p>
      {installation?.active && (
        <p className="mt-3 text-sm text-zinc-300">Active key {installation.prefix}…</p>
      )}
      {snippet && (
        <textarea
          readOnly
          value={snippet}
          className="mt-3 h-24 w-full rounded-md border border-white/10 bg-black/40 p-2 text-xs text-zinc-100"
        />
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        <Button type="button" disabled={busy} onClick={() => void issue()}>
          {installation?.active ? "Rotate key" : "Create key"}
        </Button>
        {installation?.active && (
          <Button type="button" disabled={busy} onClick={() => void revoke()}>
            Revoke key
          </Button>
        )}
      </div>
      {installation && installation.signals.length > 0 && (
        <ul className="mt-3 space-y-1 text-sm text-zinc-300">
          {installation.signals.map((signal) => (
            <li key={signal.id}>
              {signal.kind}
              {signal.selector ? ` · ${signal.selector}` : ""}
              {signal.kind === "js_error" ? ` · ${signal.message}` : ""}
            </li>
          ))}
        </ul>
      )}
      {message && <p className="mt-2 text-sm text-amber-200">{message}</p>}
    </section>
  );
}
