"use client";

import { useRef } from "react";
import { motion, useInView, AnimatePresence } from "framer-motion";
import { useState } from "react";

const FAQS = [
  {
    q: "How is WatchFlow different from basic website change detection tools?",
    a: "Most website monitoring tools only tell you that something changed. WatchFlow’s AI explains what changed, classifies it, and rates importance — like an analyst watching every page.",
  },
  {
    q: "Can I use WatchFlow for competitor monitoring?",
    a: "Yes. Track competitor pricing pages, careers, policies, and product updates. You get intelligent website alerts when something meaningful moves.",
  },
  {
    q: "What can this website monitoring tool watch?",
    a: "Entire pages, CSS selectors, XPath targets, prices, keywords, tables, job listings, or AI Smart Mode where the system decides what matters.",
  },
  {
    q: "How does noise filtering work?",
    a: "Before comparison, we strip ads, trackers, dynamic timestamps, cookies, and random IDs. Only meaningful content reaches the AI monitoring assistant.",
  },
  {
    q: "How fast can it check pages?",
    a: "Free tier: every 12 hours. Pro and Business: as fast as every 5 minutes — ideal when timing matters for SEO monitoring or price tracking.",
  },
];

export function OsFaq() {
  const ref = useRef<HTMLElement>(null);
  const inView = useInView(ref, { once: true, margin: "-10%" });
  const [open, setOpen] = useState<number | null>(0);

  return (
    <section id="faq" ref={ref} className="scroll-mt-24 bg-[#090909] py-32">
      <div className="mx-auto max-w-3xl px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          className="mb-12 text-center"
        >
          <p className="mb-3 font-mono text-[11px] uppercase tracking-[0.35em] text-cyan-500/70">Intel</p>
          <h2 className="text-3xl font-light text-zinc-100">FAQ</h2>
          <p className="mx-auto mt-3 max-w-lg text-sm text-zinc-500">
            Common questions about AI website monitoring, alerts, and how WatchFlow works.
          </p>
        </motion.div>

        <div className="space-y-2">
          {FAQS.map((faq, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 12 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ delay: i * 0.08 }}
              className="overflow-hidden rounded-xl border border-white/[0.06] bg-[#0c0c0c]"
            >
              <button
                onClick={() => setOpen(open === i ? null : i)}
                className="flex w-full items-center justify-between px-5 py-4 text-left text-sm text-zinc-300 transition-colors hover:text-cyan-100"
              >
                {faq.q}
                <motion.span
                  animate={{ rotate: open === i ? 45 : 0 }}
                  className="ml-4 shrink-0 text-cyan-500/60"
                >
                  +
                </motion.span>
              </button>
              <AnimatePresence>
                {open === i && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                  >
                    <p className="border-t border-white/[0.04] px-5 py-4 text-sm leading-relaxed text-zinc-500">
                      {faq.a}
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
