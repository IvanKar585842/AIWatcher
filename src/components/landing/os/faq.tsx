"use client";

import { useRef } from "react";
import { motion, useInView, AnimatePresence } from "framer-motion";
import { useState } from "react";

const FAQS = [
  {
    q: "How is WatchFlowing different from change detectors?",
    a: "Most tools alert you that something changed. WatchFlowing's AI explains what changed, classifies it, and rates its importance — like having an analyst watching every page.",
  },
  {
    q: "What can it monitor?",
    a: "Entire pages, CSS selectors, XPath targets, prices, keywords, tables, job listings, or AI Smart Mode where the system decides what matters.",
  },
  {
    q: "How does noise filtering work?",
    a: "Before comparison, we strip ads, trackers, dynamic timestamps, cookies, and random IDs. Only meaningful content reaches the AI.",
  },
  {
    q: "Which AI models are supported?",
    a: "OpenAI, Claude, and Gemini — switchable via a single environment variable with no code changes.",
  },
  {
    q: "How fast can it check pages?",
    a: "Free tier: every 12 hours. Pro and Business: as fast as every 5 minutes.",
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
          <h2 className="text-3xl font-light text-zinc-100">Questions</h2>
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
