"use client";

import dynamic from "next/dynamic";

const LandingDeferredClient = dynamic(
  () =>
    import("@/components/landing/landing-deferred-client").then(
      (m) => m.LandingDeferredClient
    ),
  {
    ssr: false,
    loading: () => (
      <div id="os-features" className="min-h-[200px] bg-white/[0.02]" aria-hidden />
    ),
  }
);

/** Tiny client boundary so framer-heavy sections are not in the homepage RSC graph. */
export function LandingDeferredGate() {
  return <LandingDeferredClient />;
}
