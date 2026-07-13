"use client";

import dynamic from "next/dynamic";

function SectionSkeleton({ className = "min-h-[420px]" }: { className?: string }) {
  return <div className={`animate-pulse bg-white/[0.02] ${className}`} aria-hidden="true" />;
}

const OsFeatures = dynamic(
  () => import("@/components/landing/os/features").then((m) => m.OsFeatures),
  { loading: () => <SectionSkeleton /> }
);

const OsDashboardShowcase = dynamic(
  () =>
    import("@/components/landing/os/dashboard-showcase").then((m) => m.OsDashboardShowcase),
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
  { loading: () => <SectionSkeleton className="min-h-[280px]" /> }
);

/** Below-fold marketing sections — code-split, client-only orchestration. */
export function LandingBelowFold() {
  return (
    <>
      <OsFeatures />
      <OsDashboardShowcase />
      <OsPricing />
      <OsFaq />
      <OsFooter />
    </>
  );
}
