/**
 * Server Component — how a company connects the assistant to a site it owns.
 * No client JS. The snippet is a placeholder, not a live site key.
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
            Two ways onto a site you own
          </h2>
          <p className="mt-4 text-sm leading-relaxed text-zinc-500">
            Every plan includes both. The outside look compares the page on a schedule.
            When a bot check stops that look, paste one script into the site you own.
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <article className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6">
            <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-cyan-500/70">
              From outside
            </p>
            <h3 className="mt-2 text-lg font-medium text-zinc-100">Add the page address</h3>
            <p className="mt-3 text-sm leading-relaxed text-zinc-500">
              WatchFlowing opens the page you added, stores a baseline, and explains the next
              important change. This works when the page loads without a login.
            </p>
          </article>

          <article className="rounded-2xl border border-cyan-500/20 bg-cyan-500/[0.04] p-6">
            <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-cyan-500/70">
              From your code
            </p>
            <h3 className="mt-2 text-lg font-medium text-zinc-100">
              Paste one script into your site
            </h3>
            <p className="mt-3 text-sm leading-relaxed text-zinc-500">
              You add it, so the watch is your decision. After the page loads, WatchFlowing
              receives the public text and reports what appeared or disappeared. Forms, cookies,
              and email addresses are removed, and no visitor is identified. Delete the script,
              or revoke the key, and the reports stop. It does not bypass a bot check.
            </p>
            <pre className="mt-4 overflow-x-auto rounded-xl border border-white/[0.06] bg-black/50 p-4 text-[11px] leading-relaxed text-cyan-100/90">
              <code>{`<script
  src="https://watchflowing.com/monitor.js"
  data-site-key="YOUR_KEY"
  defer></script>`}</code>
            </pre>
            <p className="mt-3 text-xs leading-relaxed text-zinc-600">
              Put it before the closing head or body tag. The real key is shown once, on the
              page settings. If the site has no visitors, the same key can send the page from
              your server, including the HTTP status.
            </p>
          </article>
        </div>
      </div>
    </section>
  );
}
