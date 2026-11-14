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
      <p className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">Your permission</p>
      <h2 className="text-lg font-medium text-zinc-100">Allow watching from inside your site</h2>
      <p className="mt-1 text-sm leading-relaxed text-zinc-400">
        Paste one script into the site you own. That is your consent. Delete the script, or revoke the key here, and the reports stop.
      </p>
      <ul className="mt-3 space-y-1 text-sm text-zinc-300">
        <li>Reports page errors and whether the pieces you name are still there.</li>
        <li>Does not read forms, cookies, page text, names, or email addresses.</li>
        <li>Does not store who visited. A sensitive error is saved only as the word error.</li>
      </ul>
      {installation?.active && (
        <p className="mt-3 text-sm text-zinc-300">Active key {installation.prefix}…</p>
      )}
      {snippet && (
        <div className="mt-3">
          <textarea
            readOnly
            value={snippet}
            className="h-24 w-full rounded-md border border-white/10 bg-black/40 p-2 text-xs text-zinc-100"
          />
          <Button
            type="button"
            className="mt-2"
            onClick={() => void navigator.clipboard.writeText(snippet).then(() => setMessage("Copied. Paste it before the closing head or body tag."))}
          >
            Copy script
          </Button>
        </div>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        <Button type="button" disabled={busy} onClick={() => void issue()}>
          {installation?.active ? "New key" : "Allow watching"}
        </Button>
        {installation?.active && (
          <Button type="button" disabled={busy} onClick={() => void revoke()}>
            Stop watching
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
