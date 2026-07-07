"use client";

import dynamic from "next/dynamic";
import { Suspense } from "react";
import { Syne, IBM_Plex_Mono } from "next/font/google";
import { OsNavbar } from "@/components/landing/os/navbar";

const HeroDashboard = dynamic(
  () => import("@/components/landing/os/hero-dashboard").then((m) => m.HeroDashboard),
  { ssr: false, loading: () => <SectionSkeleton className="min-h-screen" /> }
);

const OsFeatures = dynamic(
  () => import("@/components/landing/os/features").then((m) => m.OsFeatures),
  { loading: () => <SectionSkeleton /> }
);

const OsDashboardShowcase = dynamic(
  () => import("@/components/landing/os/dashboard-showcase").then((m) => m.OsDashboardShowcase),
  { loading: () => <SectionSkeleton /> }
);

const OsPricing = dynamic(
  () => import("@/components/landing/os/pricing").then((m) => m.OsPricing),
  { loading: () => <SectionSkeleton /> }
);

const OsFaq = dynamic(
  () => import("@/components/landing/os/faq").then((m) => m.OsFaq),
  { loading: () => <SectionSkeleton /> }
);

const OsFooter = dynamic(
  () => import("@/components/landing/os/footer").then((m) => m.OsFooter),
  { loading: () => <SectionSkeleton className="min-h-[320px]" /> }
);

const syne = Syne({
  subsets: ["latin"],
  variable: "--font-syne",
  display: "swap",
  preload: true,
});

const mono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-os-mono",
  display: "swap",
  preload: false,
});

function SectionSkeleton({ className = "min-h-[480px]" }: { className?: string }) {
  return <div className={`animate-pulse bg-white/[0.02] ${className}`} aria-hidden="true" />;
}

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
        <Suspense fallback={<SectionSkeleton className="min-h-screen" />}>
          <HeroDashboard />
        </Suspense>
        <OsFeatures />
        <OsDashboardShowcase />
        <OsPricing />
        <OsFaq />
      </main>
      <OsFooter />
    </div>
  );
}
