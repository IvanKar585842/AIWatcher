import { ScriptInstallGuide } from "@/components/dashboard/script-install-guide";

/**
 * How a company connects the assistant to a site it owns.
 * The private server key is created when a site is added and is never placed in HTML.
 */
export function OsConnect() {
  return (
    <section id="connect" className="relative scroll-mt-24 bg-[#090909] py-28">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-500/25 to-transparent" />
      <div className="mx-auto max-w-7xl px-4">
        <div className="mb-12 max-w-2xl">
          <p className="mb-3 font-mono text-[11px] uppercase tracking-[0.35em] text-cyan-500/70">
            How you connect
          </p>
          <h2 className="text-3xl font-light tracking-tight text-zinc-100 md:text-4xl">
            The report comes from your server
          </h2>
          <p className="mt-4 text-sm leading-relaxed text-zinc-500">
            A bot check stops an outside look, and a visit is not required. Your server already has the public page, so it sends that page to WatchFlowing on a timer. The private key stays on the server.
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <article className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6">
            <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-cyan-500/70">
              The page
            </p>
            <h3 className="mt-2 text-lg font-medium text-zinc-100">Your server already has the page</h3>
            <p className="mt-3 text-sm leading-relaxed text-zinc-500">
              It built the HTML before any visitor arrived. That same server sends a copy to WatchFlowing. The bot check is never asked to step aside.
            </p>
          </article>

          <article className="rounded-2xl border border-cyan-500/20 bg-cyan-500/[0.04] p-6">
            <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-cyan-500/70">
              From your code
            </p>
            <h3 className="mt-2 text-lg font-medium text-zinc-100">
              A timer, not a visitor
            </h3>
            <p className="mt-3 text-sm leading-relaxed text-zinc-500">
              The private key and the report are copied onto the server. A timer sends the public HTML that the server already rendered. Nobody has to open the page. The key is never placed in the public HTML.
            </p>
          </article>
        </div>

        <div className="mt-8 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6">
          <h3 className="text-lg font-medium text-zinc-100">The script, the key, and the steps</h3>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-zinc-500">
            Copy the private key into the server environment. Open a section to read how a check runs when nobody visits. The key never goes into HTML.
          </p>
          <div className="mt-4">
            <ScriptInstallGuide />
          </div>
        </div>
      </div>
    </section>
  );
}
