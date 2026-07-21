"use client";

import { useRef } from "react";
import { motion, useInView, useScroll, useTransform } from "framer-motion";

const MODES = [
  { id: "01", title: "Entire Page", desc: "Full-spectrum observation with noise stripped at the source." },
  { id: "02", title: "CSS / XPath", desc: "Surgical targeting. One element or section. Zero distraction." },
  { id: "03", title: "Public Pricing Pages", desc: "Plan and price wording on company pricing pages — not marketplaces." },
  { id: "04", title: "Keyword Watch", desc: "Terms appear, disappear, or spike. You know first." },
  { id: "05", title: "Documentation", desc: "Docs, changelogs, and API references tracked for meaningful edits." },
  { id: "06", title: "Job Listings", desc: "New roles, removed postings, updated requirements." },
  { id: "07", title: "AI Smart Mode", desc: "Describe what matters. The system decides what to surface." },
  { id: "08", title: "Meaningful Diff", desc: "Ads, trackers, timestamps — filtered before analysis begins." },
];

export function OsFeatures() {
  const ref = useRef<HTMLElement>(null);
  const inView = useInView(ref, { once: true, margin: "-10%" });
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const opacity = useTransform(scrollYProgress, [0, 0.2, 0.8, 1], [0, 1, 1, 0.6]);

  return (
    <motion.section
      id="features"
      ref={ref}
      style={{ opacity }}
      className="relative scroll-mt-24 bg-[#090909] py-32"
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-500/30 to-transparent" />

      <div className="mx-auto max-w-7xl px-4">
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
          className="mb-20 max-w-2xl"
        >
          <p className="mb-3 font-mono text-[11px] uppercase tracking-[0.35em] text-cyan-500/70">
            Website change detection
          </p>
          <h2 className="text-3xl font-light tracking-tight text-zinc-100 md:text-5xl">
            Eight monitoring modes.
            <br />
            <span className="text-zinc-500">One AI intelligence layer.</span>
          </h2>
          <p className="mt-4 max-w-xl text-sm leading-relaxed text-zinc-500">
            From documentation and government notices to corporate sites and GitHub releases —
            WatchFlowing tracks what matters and filters noise before you see an alert.
          </p>
        </motion.div>

        <div id="os-features" className="grid gap-px overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.03] md:grid-cols-2 lg:grid-cols-4">
          {MODES.map((mode, i) => (
            <motion.div
              key={mode.id}
              initial={{ opacity: 0, y: 24 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ delay: i * 0.06, duration: 0.5 }}
              whileHover={{ backgroundColor: "rgba(34,211,238,0.04)" }}
              className="group relative bg-[#090909] p-6 transition-colors duration-500"
            >
              <span className="font-mono text-[10px] text-cyan-500/50">{mode.id}</span>
              <h3 className="mt-3 text-sm font-medium text-zinc-200 group-hover:text-cyan-100">{mode.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-zinc-600 group-hover:text-zinc-500">{mode.desc}</p>
              <motion.div
                className="absolute bottom-0 left-0 h-px w-0 bg-cyan-400/60 group-hover:w-full"
                transition={{ duration: 0.5 }}
              />
            </motion.div>
          ))}
        </div>
      </div>
    </motion.section>
  );
}
