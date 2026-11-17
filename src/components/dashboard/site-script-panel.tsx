"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { ScriptInstallGuide } from "@/components/dashboard/script-install-guide";

type Signal = { id: string; kind: string; message: string; selector: string | null };
type Installation = { active: boolean; prefix: string | null; scriptSeen?: boolean; signals: Signal[] };

export function SiteScriptPanel({ monitorId }: { monitorId: string }) {
  const [installation, setInstallation] = useState<Installation | null>(null);
  const [serverReport, setServerReport] = useState<string | null>(null);
  const [serverKey, setServerKey] = useState<string | null>(null);
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
      setServerReport(typeof data.serverReport === "string" ? data.serverReport : null);
      setServerKey(typeof data.serverKey === "string" ? data.serverKey : null);
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function revoke() {
    setBusy(true);
    setMessage(null);
    setServerReport(null);
    setServerKey(null);
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
      <h2 className="text-lg font-medium text-zinc-100">Checked on a schedule, with no visitor</h2>
      <p className="mt-1 text-sm leading-relaxed text-zinc-400">
        Your server already has the page, so it sends a copy on a timer. A visitor is not required, and a bot check is not asked to step aside. The private key never goes into the public HTML.
      </p>
        <p className="mt-3 text-sm text-zinc-300">A server report uses the private key. A copied page id cannot send a page.</p>
      <ul className="mt-3 space-y-1 text-sm text-zinc-300">
        <li>Your server sends the public page on a timer. Nobody has to open it.</li>
        <li>The private key stays on that server. It is never pasted into HTML.</li>
        <li>A copied page id cannot store a page report.</li>
        <li>Choose Stop watching and the private key stops accepting reports.</li>
      </ul>
      {installation?.active && (
        <p className="mt-3 text-sm text-zinc-300">Active key {installation.prefix}…</p>
      )}
      <div className="mt-3">
        <ScriptInstallGuide serverKey={serverKey} serverReport={serverReport} />
      </div>
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
