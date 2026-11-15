"use client";

import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";

export const SAMPLE_SITE_SCRIPT =
  '<script src="https://watchflowing.com/monitor.js" data-site-key="YOUR_KEY" defer></script>';

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
  siteKey,
  serverReport,
  sample = false,
}: {
  snippet: string;
  siteKey?: string | null;
  serverReport?: string | null;
  sample?: boolean;
}) {
  const key = siteKey?.trim() || "";
  return (
    <div className="space-y-3">
      <CopyField label="Script to paste into your page" value={snippet} rows={sample ? 3 : 4} />
      {key ? (
        <CopyField
          label={sample ? "Placeholder only. The real site key is created on the last step" : "Site key. It is already inside the script above"}
          value={key}
          rows={2}
        />
      ) : null}
      {serverReport ? (
        <CopyField label="Server report. Use this only when nobody visits the page" value={serverReport} rows={8} />
      ) : null}

      <GuideDetails title="How to connect the script, step by step" open>
        <ol className="list-decimal space-y-2 pl-4">
          <li>Add the page in WatchFlowing and finish the form. The last step shows the script with your site key already filled in.</li>
          <li>Copy the script field. Do not type the key by hand, and do not leave the word YOUR_KEY in the tag.</li>
          <li>Open the HTML of that same page in your site editor, theme, or page template.</li>
          <li>Paste the script once, immediately before the closing body tag. Before the closing head tag also works.</li>
          <li>Publish or deploy the site so the new HTML is the page visitors open.</li>
          <li>Open that page once in a browser. WatchFlowing then receives the public words and can report what changed.</li>
          <li>To stop, delete the script from the page, or choose Stop watching on the site page. The key then stops accepting reports.</li>
        </ol>
      </GuideDetails>

      <GuideDetails title="What the site key is">
        <div className="space-y-2">
          <p>The site key is a secret WatchFlowing creates for this one page. It starts with wfsite_ and continues as a long random string.</p>
          <p>It belongs in the attribute data-site-key. The script field already contains it, so pasting the whole script is the right step.</p>
          <p>The key is shown once. If you close the step without copying it, open the site page and choose New key. The previous key stops working.</p>
          <p>It is not a password for your website, and it does not sign anyone in. WatchFlowing stores only a hash of the key. The report stays on this account.</p>
          <p>The script sends the public words on the page. It removes forms and fields first. It does not read cookies or browser storage, and it does not send who opened the page. An email address is saved as the word email.</p>
        </div>
      </GuideDetails>
    </div>
  );
}
