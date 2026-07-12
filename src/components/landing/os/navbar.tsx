"use client";

import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
import { AuthButtons } from "@/components/auth/clerk-wrappers";

export function OsNavbar() {
  return (
    <motion.header
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      className="fixed top-0 z-50 w-full border-b border-white/[0.04] bg-[#090909]/70 backdrop-blur-xl"
    >
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4">
        <Link href="/" className="group flex items-center gap-2.5" aria-label="WatchFlow home">
          <span className="relative flex h-8 w-8 items-center justify-center overflow-hidden rounded-lg border border-cyan-500/30 bg-cyan-500/5">
            <Image
              src="/favicon.svg"
              alt="WatchFlow — AI website monitoring"
              width={32}
              height={32}
              className="h-8 w-8"
              priority
            />
            <motion.span
              className="pointer-events-none absolute inset-0 rounded-lg border border-cyan-400/20"
              animate={{ scale: [1, 1.15], opacity: [0.6, 0] }}
              transition={{ duration: 2, repeat: Infinity }}
            />
          </span>
          <span className="text-sm font-medium tracking-wide text-zinc-200">
            Watch<span className="text-cyan-400">Flow</span>
          </span>
        </Link>

        <nav className="hidden items-center gap-8 md:flex" aria-label="Primary">
          {[
            { label: "Features", href: "#features" },
            { label: "System", href: "#system" },
            { label: "Pricing", href: "#pricing" },
            { label: "FAQ", href: "#faq" },
          ].map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="text-xs uppercase tracking-[0.2em] text-zinc-500 transition-colors hover:text-cyan-400/90"
            >
              {item.label}
            </Link>
          ))}
          <Link
            href="/score"
            className="text-xs uppercase tracking-[0.2em] text-zinc-500 transition-colors hover:text-cyan-400/90"
          >
            Score
          </Link>
        </nav>

        <AuthButtons
          signUpClassName="!rounded-full !border-cyan-400/30 !bg-cyan-500/10 !text-cyan-50"
          signInClassName="!text-zinc-400 hover:!text-zinc-200"
        />
      </div>
    </motion.header>
  );
}
