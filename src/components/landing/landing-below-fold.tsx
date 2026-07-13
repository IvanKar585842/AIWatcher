"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";

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

/** Below-fold sections load only when approaching the viewport. */
export function LandingBelowFold() {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: "280px 0px" }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={ref}>
      {visible ? (
        <>
          <OsFeatures />
          <OsDashboardShowcase />
          <OsPricing />
          <OsFaq />
          <OsFooter />
        </>
      ) : (
        <SectionSkeleton className="min-h-[200px]" />
      )}
    </div>
  );
}
