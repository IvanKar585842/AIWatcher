"use client";

import { useRef, useState } from "react";
import { motion, useInView } from "framer-motion";

const FAQS = [
  {
    q: "How is WatchFlowing different from basic website change detection tools?",
    a: "Most website monitoring tools only tell you that something changed. WatchFlowing’s AI explains what changed, classifies it, and rates importance — like an analyst watching every page.",
  },
  {
    q: "What sites work best with WatchFlowing?",
    a: "Public HTML pages: corporate sites, documentation, blogs, news, government and university sites, GitHub/GitLab, Wikipedia, and common builders (WordPress, Webflow, Wix, Squarespace). Marketplaces and strong anti-bot sites are often unreliable.",
  },
  {
    q: "Can I monitor competitor websites?",
    a: "Yes — public competitor pages such as documentation, careers, blogs, announcements, features, and company pricing pages. Marketplace product pages (Amazon, eBay, and similar) are not a reliable use case.",
  },
  {
    q: "What can this website monitoring tool watch?",
    a: "Entire pages, text changes, CSS/XPath sections, documentation, job listings, keywords, tables, public pricing pages, and AI Smart Mode where you describe what matters in plain language.",
  },
  {
    q: "How does noise filtering work?",
    a: "Before comparison, we strip ads, trackers, dynamic timestamps, cookies, and random IDs. Only meaningful content reaches the AI monitoring assistant.",
  },
  {
    q: "How fast can it check pages?",
    a: "Free: every 24 hours. Pro: as often as every 30 minutes. Business: as often as every 1 minute — ideal for docs, news, and public announcements where timing matters.",
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
          <p className="mb-3 font-mono text-[11px] uppercase tracking-[0.35em] text-cyan-500/70">
            FAQ
          </p>
          <h2 className="text-3xl font-light text-zinc-100">Common questions</h2>
        </motion.div>

        <div className="space-y-2">
          {FAQS.map((faq, i) => {
            const isOpen = open === i;
            return (
              <motion.div
                key={faq.q}
                initial={{ opacity: 0, y: 12 }}
                animate={inView ? { opacity: 1, y: 0 } : {}}
                transition={{ delay: i * 0.05 }}
                className="overflow-hidden rounded-xl border border-white/[0.06] bg-white/[0.02]"
              >
                <button
                  type="button"
                  onClick={() => setOpen(isOpen ? null : i)}
                  className="flex min-h-12 w-full items-center justify-between gap-4 px-5 py-4 text-left"
                >
                  <span className="text-sm font-medium text-zinc-200">{faq.q}</span>
                  <span className="font-mono text-xs text-cyan-500/60">{isOpen ? "−" : "+"}</span>
                </button>
                {isOpen && (
                  <div className="border-t border-white/[0.04] px-5 pb-4 pt-1">
                    <p className="text-sm leading-relaxed text-zinc-500">{faq.a}</p>
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
