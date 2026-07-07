"use client";

import { useState } from "react";
import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import { Check } from "lucide-react";
import { SignUpCTA } from "@/components/auth/clerk-wrappers";
import { PRICING_PLANS } from "@/lib/constants";
import { cn } from "@/lib/utils";

export function OsPricing() {
  const ref = useRef<HTMLElement>(null);
  const inView = useInView(ref, { once: true, margin: "-10%" });
  const [hovered, setHovered] = useState<string | null>(null);

  return (
    <section id="pricing" ref={ref} className="relative scroll-mt-24 bg-[#090909] py-32">
      <div className="mx-auto max-w-7xl px-4">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          className="mb-16 text-center"
        >
          <p className="mb-3 font-mono text-[11px] uppercase tracking-[0.35em] text-cyan-500/70">Access Tiers</p>
          <h2 className="text-3xl font-light text-zinc-100 md:text-4xl">Scale your observation grid</h2>
        </motion.div>

        <div className="grid gap-6 md:grid-cols-3">
          {PRICING_PLANS.map((plan, i) => {
            const isPopular = plan.popular;
            const isHovered = hovered === plan.id;

            return (
              <motion.div
                key={plan.id}
                initial={{ opacity: 0, y: 30 }}
                animate={
                  inView
                    ? {
                        opacity: 1,
                        y: isHovered ? -8 : 0,
                        scale: isHovered ? 1.03 : 1,
                      }
                    : { opacity: 0, y: 30 }
                }
                transition={{ delay: i * 0.1, type: "spring", stiffness: 260, damping: 22 }}
                onMouseEnter={() => setHovered(plan.id)}
                onMouseLeave={() => setHovered(null)}
                className={cn(
                  "relative rounded-2xl border bg-[#0c0c0c] p-8 transition-shadow duration-500",
                  isPopular
                    ? "border-cyan-500/30 shadow-[0_0_60px_-15px_rgba(34,211,238,0.35)]"
                    : "border-white/[0.06]",
                  isHovered && !isPopular && "border-white/10 shadow-[0_20px_60px_-20px_rgba(0,0,0,0.5)]"
                )}
              >
                {isPopular && (
                  <motion.div
                    animate={{ opacity: [0.4, 0.8, 0.4] }}
                    transition={{ duration: 3, repeat: Infinity }}
                    className="pointer-events-none absolute -inset-px rounded-2xl bg-gradient-to-b from-cyan-500/20 to-transparent"
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
                    <SignUpCTA
                      className={cn(
                        "w-full !rounded-full !py-3 !text-sm",
                        isPopular
                          ? "!border-cyan-400/40 !bg-cyan-500/15 !text-cyan-100"
                          : "!border-white/10 !bg-white/[0.03] !text-zinc-300"
                      )}
                    >
                      {plan.cta}
                    </SignUpCTA>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
