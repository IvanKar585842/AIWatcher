"use client";

import { Syne, IBM_Plex_Mono } from "next/font/google";
import { OsNavbar } from "@/components/landing/os/navbar";
import { HeroDashboard } from "@/components/landing/os/hero-dashboard";
import { OsFeatures } from "@/components/landing/os/features";
import { OsDashboardShowcase } from "@/components/landing/os/dashboard-showcase";
import { OsPricing } from "@/components/landing/os/pricing";
import { OsFaq } from "@/components/landing/os/faq";
import { OsFooter } from "@/components/landing/os/footer";

const syne = Syne({
  subsets: ["latin"],
  variable: "--font-syne",
  display: "swap",
});

const mono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-os-mono",
  display: "swap",
});

export function LandingPage() {
  return (
    <div
      className={`landing-os min-h-screen bg-[#090909] text-zinc-300 selection:bg-cyan-500/20 selection:text-cyan-100 ${syne.variable} ${mono.variable} font-[family-name:var(--font-syne)]`}
    >
      <style jsx global>{`
        .landing-os .font-mono {
          font-family: var(--font-os-mono), ui-monospace, monospace;
        }
      `}</style>
      <OsNavbar />
      <main>
        <HeroDashboard />
        <OsFeatures />
        <OsDashboardShowcase />
        <OsPricing />
        <OsFaq />
      </main>
      <OsFooter />
    </div>
  );
}
