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
      className="group/guide overflow-hidden rounded-lg border border-white/[0.06] bg-black/20 open:border-cyan-500/20"
    >
      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 px-3 py-2 text-left marker:content-none [&::-webkit-details-marker]:hidden">
        <span className="text-sm font-medium text-zinc-200">{title}</span>
        <span className="font-mono text-xs text-cyan-500/70 group-open/guide:hidden">+</span>
        <span className="hidden font-mono text-xs text-cyan-500/70 group-open/guide:inline">−</span>
      </summary>
      <div className="border-t border-white/[0.04] px-3 py-3 text-sm leading-relaxed text-zinc-400">{children}</div>
    </details>
  );
}

export function ScriptInstallGuide({
  snippet,
  serverKey,
  serverReport,
  guideOpen = false,
}: {
  snippet?: string | null;
  serverKey?: string | null;
  serverReport?: string | null;
  sample?: boolean;
  guideOpen?: boolean;
}) {
  const privateKey = serverKey?.trim() || "";
  const script = snippet?.trim() || "";
  return (
    <div className="space-y-3">
      {script ? <CopyField label="Page script" value={script} rows={3} /> : null}
      {privateKey ? <CopyField label="Private key" value={privateKey} rows={2} /> : null}
      {serverReport ? <CopyField label="Server program" value={serverReport} rows={16} /> : null}

      <GuideDetails title="Full guide: connect the server on Windows, Mac, or Linux" open={guideOpen}>
        <div className="space-y-3">
          <p>
            The last step of adding a site gives you one file, <span className="font-mono text-zinc-200">watchflowing-report.mjs</span>. The private key is already inside that file. Save it on the server that builds the page, next to the HTML that server just wrote. Then run the file on a timer. WatchFlowing compares each copy with the previous one.
          </p>
          <p>
            <span className="font-mono text-zinc-200">page.html</span> is that public page. For a static site it is often <span className="font-mono text-zinc-200">dist/index.html</span> after the build. For a site with its own server, save the HTML that server already produced and pass that path. The file has to be the real page. A comment or an empty file is what gets stored.
          </p>
          <p>One run looks like this. A successful run prints <span className="font-mono text-zinc-200">WatchFlowing accepted the page</span>.</p>
          <pre className="overflow-x-auto rounded-md bg-black/50 p-2 font-mono text-[11px] leading-relaxed text-zinc-200">node watchflowing-report.mjs ./page.html</pre>
          <p>Find Node with <span className="font-mono text-zinc-200">where.exe node</span> on Windows, or <span className="font-mono text-zinc-200">which node</span> on Mac and Linux. Use that full path in the timer. Repeat about every 5 minutes. The computer that runs the timer has to be awake.</p>

          <GuideDetails title="Windows">
            <ol className="list-decimal space-y-2 pl-4">
              <li>Save the program from the last step as watchflowing-report.mjs in the site folder, for example C:\sites\mine\watchflowing-report.mjs.</li>
              <li>Put the rendered public page beside it as page.html.</li>
              <li>Open Start, search for Task Scheduler, and choose Create Basic Task.</li>
              <li>Name it WatchFlowing report. Trigger: Daily. Action: Start a program.</li>
              <li>Program/script: the full path from where.exe node. Add arguments: the full path of watchflowing-report.mjs, then the full path of page.html. Start in: the folder that contains those files.</li>
              <li>Open the new task, open Triggers, edit the daily trigger, and turn on Repeat task every 5 minutes for 1 day. Check that the task is enabled.</li>
              <li>Right-click the task and choose Run. The last result should be 0, and the site in WatchFlowing shows the new check.</li>
            </ol>
          </GuideDetails>

          <GuideDetails title="Mac">
            <ol className="list-decimal space-y-2 pl-4">
              <li>Save the program in the site folder, for example /Users/you/site/watchflowing-report.mjs, with page.html beside it.</li>
              <li>Open Terminal and run which node. Copy the path it prints, often /opt/homebrew/bin/node or /usr/local/bin/node.</li>
              <li>Run crontab -e. If it asks for an editor, choose nano.</li>
              <li>Add one line. Replace both paths with yours. The first path is Node, then the program, then the HTML file.</li>
            </ol>
            <pre className="mt-2 overflow-x-auto rounded-md bg-black/50 p-2 font-mono text-[11px] leading-relaxed text-zinc-200">{`*/5 * * * * /opt/homebrew/bin/node /Users/you/site/watchflowing-report.mjs /Users/you/site/page.html`}</pre>
            <p className="mt-2">Save the crontab. A sleeping Mac skips the runs while it is asleep. After the next run, WatchFlowing shows the check.</p>
          </GuideDetails>

          <GuideDetails title="Linux">
            <ol className="list-decimal space-y-2 pl-4">
              <li>Save the program on the server that builds the page, with the rendered HTML beside it.</li>
              <li>Run which node and crontab -e.</li>
              <li>Add a line with the full Node path, the program path, and the HTML path.</li>
            </ol>
            <pre className="mt-2 overflow-x-auto rounded-md bg-black/50 p-2 font-mono text-[11px] leading-relaxed text-zinc-200">{`*/5 * * * * /usr/bin/node /var/www/site/watchflowing-report.mjs /var/www/site/page.html`}</pre>
            <p className="mt-2">Save and exit. Cron runs it every 5 minutes while the server is on.</p>
          </GuideDetails>

          <p>
            The first accepted report becomes the baseline. The next one tells you what appeared or disappeared. The check does not open the website and does not wait for a visitor.
          </p>
          <p>
            On the site page, Stop watching turns the key off. New key writes a new key into a new copy of the program, and the old file stops working. Delete the scheduled task when you stop, so the server does not keep sending.
          </p>
        </div>
      </GuideDetails>
    </div>
  );
}
