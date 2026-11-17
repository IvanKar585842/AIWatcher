"use client";

import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";

export const SAMPLE_SITE_SCRIPT =
  '<script src="https://watchflowing.com/monitor.js" data-site-key="YOUR_SITE_ID" defer></script>';

export function siteKeyFromSnippet(snippet: string): string {
  return snippet.match(/data-site-key="([^"]+)"/)?.[1] ?? "";
}

function CopyField({ label, value, rows }: { label: string; value: string; rows: number }) {
  const [note, setNote] = useState<string | null>(null);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setNote("Copied");
    } catch {
      setNote("Select the field and copy it");
    }
  }

  return (
    <div>
      <label className="mb-1 block text-sm text-zinc-300">{label}</label>
      <textarea
        readOnly
        rows={rows}
        value={value}
        onFocus={(event) => event.currentTarget.select()}
        className="w-full rounded-md border border-white/10 bg-black/40 p-2 font-mono text-xs leading-relaxed text-zinc-100"
      />
      <Button type="button" className="mt-2 bg-cyan-500 text-black hover:bg-cyan-400" onClick={() => void copy()}>
        Copy
      </Button>
      {note && <p className="mt-1 text-xs text-cyan-200">{note}</p>}
    </div>
  );
}

function GuideDetails({ title, children, open = false }: { title: string; children: ReactNode; open?: boolean }) {
  return (
    <details
      open={open}
      className="group overflow-hidden rounded-lg border border-white/[0.06] bg-black/20 open:border-cyan-500/20"
    >
      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 px-3 py-2 text-left marker:content-none [&::-webkit-details-marker]:hidden">
        <span className="text-sm font-medium text-zinc-200">{title}</span>
        <span className="font-mono text-xs text-cyan-500/70 group-open:hidden">+</span>
        <span className="hidden font-mono text-xs text-cyan-500/70 group-open:inline">−</span>
      </summary>
      <div className="border-t border-white/[0.04] px-3 py-3 text-sm leading-relaxed text-zinc-400">{children}</div>
    </details>
  );
}

export function ScriptInstallGuide({
  snippet,
  serverKey,
  serverReport,
}: {
  snippet?: string | null;
  serverKey?: string | null;
  serverReport?: string | null;
  sample?: boolean;
}) {
  const privateKey = serverKey?.trim() || "";
  const script = snippet?.trim() || "";
  return (
    <div className="space-y-3">
      {script ? (
        <CopyField label="Do not paste this into the public page" value={script} rows={3} />
      ) : null}
      {privateKey ? (
        <CopyField label="Private server key. Put it in the server environment. Never paste it into HTML" value={privateKey} rows={2} />
      ) : null}
      {serverReport ? (
        <CopyField label="Scheduled server report. Runs even when nobody opens the page" value={serverReport} rows={8} />
      ) : null}

      <GuideDetails title="How this works when a bot check is on the site" open>
        <ol className="list-decimal space-y-2 pl-4">
          <li>Your server already creates the public page. WatchFlowing does not ask the bot check to let it in.</li>
          <li>Add the page in WatchFlowing. The last step shows a private key and a report. Copy both onto the server, never into the public HTML.</li>
          <li>On a timer, that server sends the public HTML it already rendered, together with the private key. Nobody has to open the page.</li>
          <li>WatchFlowing compares that report with the previous one and tells you what appeared or disappeared.</li>
          <li>To stop, choose Stop watching. The private key then stops accepting reports.</li>
        </ol>
      </GuideDetails>

      <GuideDetails title="What goes in the script, and what must stay secret">
        <div className="space-y-2">
          <p>WatchFlowing does not open the page from outside, and it does not wait for a visitor. The report comes from your server, which already has the page.</p>
          <p>The private server key starts with wfsite_. It is shown once. It travels only in the server report. It is never pasted into the public HTML, because anything in the HTML can be read by anyone.</p>
          <p>If that key was copied into a page, choose New key. The old key stops working. WatchFlowing stores only a hash of it.</p>
        </div>
      </GuideDetails>
    </div>
  );
}
