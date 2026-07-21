"use client";

import { useRef } from "react";
import { motion, useInView } from "framer-motion";
import {
  Ban,
  BookOpen,
  Building2,
  CheckCircle2,
  FileText,
  Github,
  Globe2,
  GraduationCap,
  Landmark,
  Newspaper,
  ShieldAlert,
} from "lucide-react";
import {
  ANTIBOT_DISCLAIMER,
  CANNOT_MONITOR_REASONS,
  FULLY_SUPPORTED_SITES,
  PARTIALLY_SUPPORTED_SITES,
  REAL_USE_CASES,
  UNSUPPORTED_OR_UNSTABLE_SITES,
} from "@/lib/supported-websites";

const CATEGORY_ICONS = [
  { icon: Globe2, label: "Public websites" },
  { icon: Building2, label: "Corporate sites" },
  { icon: BookOpen, label: "Documentation" },
  { icon: Newspaper, label: "News & blogs" },
  { icon: Github, label: "GitHub / GitLab" },
  { icon: Landmark, label: "Government" },
  { icon: GraduationCap, label: "Universities" },
  { icon: FileText, label: "Policies & legal" },
] as const;

export function OsSupportedWebsites() {
  const ref = useRef<HTMLElement>(null);
  const inView = useInView(ref, { once: true, margin: "-10%" });

  return (
    <section
      id="supported-websites"
      ref={ref}
      className="relative scroll-mt-24 bg-[#090909] py-28"
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-500/25 to-transparent" />

      <div className="mx-auto max-w-7xl px-4">
        <motion.div
          initial={{ opacity: 0, y: 28 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          className="mb-14 max-w-2xl"
        >
          <p className="mb-3 font-mono text-[11px] uppercase tracking-[0.35em] text-cyan-500/70">
            Supported websites
          </p>
          <h2 className="text-3xl font-light tracking-tight text-zinc-100 md:text-4xl">
            What can WatchFlowing monitor?
          </h2>
          <p className="mt-4 text-sm leading-relaxed text-zinc-500">
            Built for public HTML pages — documentation, news, government notices,
            university updates, corporate sites, and more. AI explains meaningful changes.
          </p>
        </motion.div>

        <div className="mb-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {CATEGORY_ICONS.map((item, i) => {
            const Icon = item.icon;
            return (
              <motion.div
                key={item.label}
                initial={{ opacity: 0, y: 16 }}
                animate={inView ? { opacity: 1, y: 0 } : {}}
                transition={{ delay: i * 0.04, duration: 0.45 }}
                className="flex items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-cyan-500/20 bg-cyan-500/10">
                  <Icon className="h-4 w-4 text-cyan-300" />
                </div>
                <span className="text-sm text-zinc-300">{item.label}</span>
              </motion.div>
            );
          })}
        </div>

        <div className="mb-12 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {REAL_USE_CASES.slice(0, 9).map((useCase, i) => (
            <motion.div
              key={useCase.id}
              initial={{ opacity: 0, y: 12 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ delay: 0.15 + i * 0.03, duration: 0.4 }}
              className="rounded-xl border border-white/[0.05] bg-black/30 px-4 py-3"
            >
              <p className="text-sm font-medium text-zinc-200">{useCase.label}</p>
              <p className="mt-1 text-xs leading-relaxed text-zinc-500">
                {useCase.description}
              </p>
            </motion.div>
          ))}
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ delay: 0.2, duration: 0.5 }}
            className="rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.04] p-6"
          >
            <div className="mb-4 flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-emerald-400" />
              <h3 className="text-base font-medium text-emerald-100">Supported websites</h3>
            </div>
            <ul className="mb-4 grid gap-1.5 sm:grid-cols-2">
              {FULLY_SUPPORTED_SITES.map((item) => (
                <li key={item} className="flex items-start gap-2 text-sm text-zinc-400">
                  <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-emerald-400/80" />
                  {item}
                </li>
              ))}
            </ul>
            <p className="mb-2 text-xs font-medium uppercase tracking-wider text-amber-200/80">
              Partial support
            </p>
            <ul className="mb-4 space-y-1">
              {PARTIALLY_SUPPORTED_SITES.map((item) => (
                <li key={item} className="text-sm text-zinc-500">
                  · {item}
                </li>
              ))}
            </ul>
            <p className="text-xs leading-relaxed text-zinc-500">{ANTIBOT_DISCLAIMER}</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ delay: 0.28, duration: 0.5 }}
            className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-6"
          >
            <div className="mb-4 flex items-center gap-2">
              <Ban className="h-5 w-5 text-zinc-400" />
              <h3 className="text-base font-medium text-zinc-100">What cannot be monitored</h3>
            </div>
            <div className="mb-5 space-y-3">
              {CANNOT_MONITOR_REASONS.map((row) => (
                <div key={row.label} className="flex gap-3">
                  <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-zinc-500" />
                  <div>
                    <p className="text-sm font-medium text-zinc-300">{row.label}</p>
                    <p className="mt-0.5 text-xs leading-relaxed text-zinc-500">
                      {row.detail}
                    </p>
                  </div>
                </div>
              ))}
            </div>
            <p className="mb-2 text-xs font-medium uppercase tracking-wider text-zinc-500">
              Often unstable
            </p>
            <p className="text-sm leading-relaxed text-zinc-500">
              {UNSUPPORTED_OR_UNSTABLE_SITES.slice(0, 8).join(" · ")}
              {" · "}and similar protected sites.
            </p>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
