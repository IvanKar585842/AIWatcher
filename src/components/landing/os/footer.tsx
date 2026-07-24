import Link from "next/link";

/**
 * Server Component footer — no framer-motion / canvas on the marketing critical path.
 */
export function OsFooter() {
  const year = new Date().getFullYear();

  return (
    <footer
      id="os-footer"
      className="relative overflow-hidden border-t border-white/[0.04] bg-[#090909]"
    >
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-[radial-gradient(ellipse_at_top,rgba(56,189,248,0.08),transparent_70%)]"
        aria-hidden
      />

      <div className="relative mx-auto max-w-7xl px-4 pb-16 pt-16">
        <div className="mb-16 text-center">
          <h2 className="text-2xl font-light text-zinc-200 md:text-3xl">
            Start AI website monitoring today
          </h2>
          <p className="mt-3 text-sm text-zinc-600">
            Deploy your first monitor in under 60 seconds — free plan included.
          </p>
          <div className="mt-6 flex justify-center">
            <Link
              href="/sign-up"
              className="inline-flex h-10 items-center justify-center rounded-full border border-cyan-400/30 bg-cyan-500/10 px-8 text-sm font-medium text-cyan-100 transition-colors hover:border-cyan-300/50 hover:bg-cyan-500/15"
            >
              Create free account
            </Link>
          </div>
        </div>

        <div className="flex flex-col items-center justify-between gap-6 border-t border-white/[0.04] pt-8 md:flex-row">
          <p className="font-mono text-[10px] tracking-widest text-zinc-600">
            WatchFlowing © {year} · watchflowing.com
          </p>
          <div className="flex flex-wrap justify-center gap-8">
            {[
              { label: "Features", href: "#os-features" },
              { label: "Pricing", href: "#pricing" },
              { label: "FAQ", href: "#faq" },
              { label: "Score", href: "/score" },
              { label: "Dashboard", href: "/dashboard" },
            ].map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className="text-xs uppercase tracking-[0.15em] text-zinc-600 transition-colors hover:text-cyan-500/80"
              >
                {l.label}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
