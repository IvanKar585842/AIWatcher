"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { SAMPLE_SITE_SCRIPT, ScriptInstallGuide, siteKeyFromSnippet } from "@/components/dashboard/script-install-guide";

type Signal = { id: string; kind: string; message: string; selector: string | null };
type Installation = { active: boolean; prefix: string | null; scriptSeen?: boolean; signals: Signal[] };

export function SiteScriptPanel({ monitorId }: { monitorId: string }) {
  const [installation, setInstallation] = useState<Installation | null>(null);
  const [snippet, setSnippet] = useState<string | null>(null);
  const [serverReport, setServerReport] = useState<string | null>(null);
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
      setServerReport(typeof data.serverReport === "string" ? data.serverReport : null);
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function revoke() {
    setBusy(true);
    setMessage(null);
    setSnippet(null);
    setServerReport(null);
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
      <h2 className="text-lg font-medium text-zinc-100">Paste one script into the site you own</h2>
      <p className="mt-1 text-sm leading-relaxed text-zinc-400">
        The script is shown when you add the site. Until it is on the page, this watch cannot see it. Place it once, just before the closing body tag.
      </p>
      {installation?.scriptSeen ? (
        <p className="mt-3 text-sm text-emerald-300">The script has reported this page.</p>
      ) : (
        <p className="mt-3 text-sm text-amber-200">Waiting for the script. Without it, the page is not being watched.</p>
      )}
      <ul className="mt-3 space-y-1 text-sm text-zinc-300">
        <li>You see the public page, including prices, headings, and the words on it.</li>
        <li>Forms, cookies, and email addresses are removed. No visitor is identified.</li>
        <li>Delete the script, or revoke the key, and the reports stop.</li>
        <li>With no visitors, the same key can send the page from your server, including the HTTP status.</li>
      </ul>
      {installation?.active && (
        <p className="mt-3 text-sm text-zinc-300">Active key {installation.prefix}…</p>
      )}
      <div className="mt-3">
        <ScriptInstallGuide
          snippet={snippet ?? SAMPLE_SITE_SCRIPT}
          siteKey={snippet ? siteKeyFromSnippet(snippet) : "YOUR_KEY"}
          serverReport={serverReport}
          sample={!snippet}
        />
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
