import Link from "next/link";
import { Check } from "lucide-react";
import { PRICING_PLANS } from "@/lib/constants";
import { cn } from "@/lib/utils";

/**
 * Server Component — no framer-motion, no Clerk during SSG (plain Links).
 */
export function OsPricing() {
  return (
    <section id="pricing" className="relative scroll-mt-24 bg-[#090909] py-32">
      <div className="mx-auto max-w-7xl px-4">
        <div className="mb-16 text-center">
          <p className="mb-3 font-mono text-[11px] uppercase tracking-[0.35em] text-cyan-500/70">
            Access Tiers
          </p>
          <h2 className="text-3xl font-light text-zinc-100 md:text-4xl">
            Pay for clarity, not just more monitors
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-sm text-zinc-500">
            Every plan unlocks smarter website change detection, faster checks, and better
            alerts — so you know what changed and why it matters.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          {PRICING_PLANS.map((plan) => {
            const isPopular = plan.popular;
            const href =
              plan.id === "free"
                ? "/sign-up"
                : plan.id === "pro"
                  ? "/sign-up?redirect_url=%2Fdashboard%2Fbilling%3Fplan%3DPRO"
                  : "/sign-up?redirect_url=%2Fdashboard%2Fbilling%3Fplan%3DBUSINESS";

            return (
              <div
                key={plan.id}
                className={cn(
                  "relative rounded-2xl border bg-[#0c0c0c] p-8 transition-shadow duration-300 hover:-translate-y-1 hover:shadow-[0_20px_60px_-20px_rgba(0,0,0,0.5)]",
                  isPopular
                    ? "border-cyan-500/30 shadow-[0_0_60px_-15px_rgba(34,211,238,0.35)]"
                    : "border-white/[0.06] hover:border-white/10"
                )}
              >
                {isPopular && (
                  <div
                    className="pointer-events-none absolute -inset-px rounded-2xl bg-gradient-to-b from-cyan-500/20 to-transparent"
                    aria-hidden
                  />
                )}

                <div className="relative">
                  {isPopular && (
                    <span className="mb-4 inline-block font-mono text-[10px] uppercase tracking-widest text-cyan-400">
                      Recommended
                    </span>
                  )}
                  <h3 className="text-lg font-medium text-zinc-200">{plan.name}</h3>
                  <p className="mt-1 text-sm text-zinc-600">{plan.description}</p>
                  <div className="mt-6 flex items-baseline gap-1">
                    <span className="text-4xl font-light text-zinc-100">${plan.price}</span>
                    {plan.price > 0 && <span className="text-zinc-600">/mo</span>}
                  </div>

                  <ul className="mt-8 space-y-3">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-start gap-2 text-sm text-zinc-500">
                        <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-cyan-500/70" />
                        {f}
                      </li>
                    ))}
                  </ul>

                  <div className="mt-8">
                    <Link
                      href={href}
                      className={cn(
                        "inline-flex w-full items-center justify-center rounded-full border py-3 text-sm font-medium transition-colors",
                        isPopular
                          ? "border-cyan-400/40 bg-cyan-500/15 text-cyan-100 hover:bg-cyan-500/25"
                          : "border-white/10 bg-white/[0.03] text-zinc-300 hover:border-white/20"
                      )}
                    >
                      {plan.cta}
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
