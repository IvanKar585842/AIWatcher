"use client";

import dynamic from "next/dynamic";

const HeroDashboardVisual = dynamic(
  () =>
    import("@/components/landing/os/hero-dashboard").then((m) => m.HeroDashboardVisual),
  {
    ssr: false,
    loading: () => (
      <div
        className="mx-auto aspect-[16/10] w-full max-w-5xl animate-pulse rounded-2xl border border-white/[0.06] bg-white/[0.02]"
        aria-hidden
      />
    ),
  }
);

export function HeroVisualLoader() {
  return <HeroDashboardVisual />;
}
