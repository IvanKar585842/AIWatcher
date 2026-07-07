"use client";

import Link from "next/link";
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
        <Link href="/" className="group flex items-center gap-2.5">
          <span className="relative flex h-8 w-8 items-center justify-center rounded-lg border border-cyan-500/30 bg-cyan-500/5">
            <span className="h-2 w-2 rounded-full bg-cyan-400 shadow-[0_0_12px_rgba(34,211,238,0.8)]" />
            <motion.span
              className="absolute inset-0 rounded-lg border border-cyan-400/20"
              animate={{ scale: [1, 1.15], opacity: [0.6, 0] }}
              transition={{ duration: 2, repeat: Infinity }}
            />
          </span>
          <span className="text-sm font-medium tracking-wide text-zinc-200">
            Watch<span className="text-cyan-400">Flow</span>
          </span>
        </Link>

        <nav className="hidden items-center gap-8 md:flex">
          {["Features", "System", "Pricing", "FAQ"].map((item) => (
            <Link
              key={item}
              href={`#${item.toLowerCase()}`}
              className="text-xs uppercase tracking-[0.2em] text-zinc-500 transition-colors hover:text-cyan-400/90"
            >
              {item}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <AuthButtons
            signInClassName="!text-zinc-500 hover:!text-cyan-400 !text-xs"
            signUpClassName="!rounded-full !border-cyan-400/30 !bg-cyan-500/10 !text-cyan-100 !text-xs !px-4 !py-2 hover:!border-cyan-300/50"
          />
        </div>
      </div>
    </motion.header>
  );
}
