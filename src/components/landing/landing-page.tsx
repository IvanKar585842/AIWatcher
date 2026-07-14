import Link from "next/link";
import { OsNavbar } from "@/components/landing/os/navbar";
import { HeroVisualLoader } from "@/components/landing/os/hero-visual-loader";
import { LandingBelowFold } from "@/components/landing/landing-below-fold";

/** Static hero chrome in initial HTML so LCP is not delayed by client JS. */
function HeroVisualShell() {
  return (
    <div
      className="mx-auto aspect-[16/10] w-full max-w-5xl overflow-hidden rounded-2xl border border-white/[0.06] bg-gradient-to-b from-white/[0.04] to-transparent"
      aria-hidden
    >
      <div className="flex h-10 items-center gap-2 border-b border-white/[0.05] px-4">
        <span className="h-2 w-2 rounded-full bg-zinc-600" />
        <span className="h-2 w-2 rounded-full bg-zinc-600" />
        <span className="h-2 w-2 rounded-full bg-zinc-600" />
        <span className="ml-3 h-2 w-32 rounded bg-zinc-700/80" />
      </div>
      <div className="grid h-[calc(100%-2.5rem)] grid-cols-3 gap-3 p-4">
        <div className="col-span-2 rounded-xl bg-cyan-500/[0.04]" />
        <div className="space-y-3">
          <div className="h-1/3 rounded-xl bg-white/[0.03]" />
          <div className="h-1/3 rounded-xl bg-white/[0.03]" />
          <div className="h-1/3 rounded-xl bg-white/[0.03]" />
        </div>
      </div>
    </div>
  );
}

/**
 * Server Component landing shell.
 * H1 + hero chrome ship in the initial HTML (LCP).
 * Heavy visuals and below-fold sections hydrate separately.
 */
export function LandingPage() {
  return (
    <div className="landing-os min-h-screen bg-[#090909] text-zinc-300 selection:bg-cyan-500/20 selection:text-cyan-100">
      <OsNavbar />
      <main>
        <section className="relative min-h-[100svh] overflow-hidden bg-[#090909] pt-24 pb-16">
          <div
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-10%,rgba(14,165,233,0.14),transparent)]"
            aria-hidden
          />

          <div className="relative z-10 mx-auto max-w-7xl px-4">
            <div className="mb-10 flex flex-col items-center text-center">
              <p className="wf-enter mb-4 font-mono text-[11px] uppercase tracking-[0.35em] text-cyan-400/70">
                AI Website Monitoring · Online
              </p>
              <h1 className="wf-enter-delay-1 max-w-4xl text-4xl font-light tracking-tight text-zinc-100 sm:text-5xl md:text-6xl">
                AI website monitoring
                <br />
                <span className="font-normal text-cyan-300">that explains every change.</span>
              </h1>
              <p className="wf-enter-delay-2 mt-5 max-w-xl text-base leading-relaxed text-zinc-500">
                WatchFlowing is an AI website tracker and intelligence platform — detect important
                updates, analyze what changed, and get smart website alerts without the noise.
              </p>
              <div className="wf-enter-delay-3 mt-8 flex flex-wrap items-center justify-center gap-4">
                <Link
                  href="/sign-up"
                  className="inline-flex min-h-11 items-center justify-center rounded-full border border-cyan-400/30 bg-cyan-500/10 px-8 py-3 text-sm font-medium text-cyan-50 transition-all duration-200 hover:border-cyan-300/50 hover:bg-cyan-500/15"
                >
                  Start free monitoring
                </Link>
                <a
                  href="#os-features"
                  className="inline-flex min-h-11 items-center justify-center rounded-full px-6 py-3 text-sm text-zinc-400 transition-colors duration-200 hover:text-zinc-200"
                >
                  Explore capabilities
                </a>
              </div>
            </div>

            <div className="wf-enter-delay-4">
              <HeroVisualLoader fallback={<HeroVisualShell />} />
            </div>
          </div>
        </section>

        <LandingBelowFold />
      </main>
    </div>
  );
}
