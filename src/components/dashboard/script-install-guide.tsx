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
      {script ? <CopyField label="Page script" value={script} rows={3} /> : null}
      {privateKey ? <CopyField label="Private key" value={privateKey} rows={2} /> : null}
      {serverReport ? <CopyField label="Server program" value={serverReport} rows={16} /> : null}

      <GuideDetails title="How to connect your site" open>
        <ol className="list-decimal space-y-2 pl-4">
          <li>Add the page in WatchFlowing. The last step shows a private key and a server program. The key starts with wfsite_ and is stored here only as a hash.</li>
          <li>On the server that already builds that page, save the program as watchflowing-report.mjs. The key inside that file stays on the server.</li>
          <li>Save the public HTML that server already rendered, for example the homepage file it just wrote. Run node watchflowing-report.mjs ./page.html. The file must be the real page. A comment is stored as the page.</li>
          <li>Repeat that command on a timer, about every 5 minutes. On Windows this is Task Scheduler. On a Linux server it is cron. WatchFlowing compares this copy with the previous one and reports what appeared or disappeared.</li>
          <li>The check does not open the site and does not wait for a visitor. Choose Stop watching, or New key, and the old key stops accepting reports.</li>
        </ol>
      </GuideDetails>
    </div>
  );
}
