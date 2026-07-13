"use client";

import Link from "next/link";
import Image from "next/image";
import { AuthButtons } from "@/components/auth/clerk-wrappers";

export function OsNavbar() {
  return (
    <header className="fixed top-0 z-50 w-full border-b border-white/[0.04] bg-[#090909]/80 backdrop-blur-xl">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4">
        <Link href="/" className="group flex items-center gap-2.5" aria-label="WatchFlowing home">
          <span className="relative flex h-8 w-8 items-center justify-center overflow-hidden rounded-lg border border-cyan-500/30 bg-cyan-500/5">
            <Image
              src="/favicon.svg"
              alt=""
              width={32}
              height={32}
              className="h-8 w-8"
            />
          </span>
          <span className="text-sm font-medium tracking-wide text-zinc-200">
            Watch<span className="text-cyan-400">Flowing</span>
          </span>
        </Link>

        <nav className="hidden items-center gap-8 md:flex" aria-label="Primary">
          {[
            { label: "Features", href: "#features" },
            { label: "Platform", href: "#showcase" },
            { label: "Pricing", href: "#pricing" },
            { label: "FAQ", href: "#faq" },
          ].map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="text-xs uppercase tracking-[0.18em] text-zinc-500 transition-colors hover:text-cyan-400/90"
            >
              {item.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <AuthButtons
            signInClassName="text-zinc-400 hover:text-zinc-200"
            signUpClassName="rounded-full border border-cyan-400/30 bg-cyan-500/10 text-cyan-100 hover:border-cyan-300/50"
          />
        </div>
      </div>
    </header>
  );
}
