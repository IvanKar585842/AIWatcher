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

const OsSupportedWebsites = dynamic(
  () =>
    import("@/components/landing/os/supported-websites").then((m) => m.OsSupportedWebsites),
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

/** Below-fold: first section near viewport; rest after idle so they don't compete with LCP. */
export function LandingBelowFold() {
  const ref = useRef<HTMLDivElement>(null);
  const [showPrimary, setShowPrimary] = useState(false);
  const [showRest, setShowRest] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setShowPrimary(true);
          observer.disconnect();
        }
      },
      { rootMargin: "40px 0px" }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!showPrimary) return;

    let idleId: number | undefined;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    const enable = () => setShowRest(true);

    if ("requestIdleCallback" in window) {
      idleId = window.requestIdleCallback(enable, { timeout: 2500 });
    } else {
      timeoutId = setTimeout(enable, 600);
    }

    return () => {
      if (idleId !== undefined && "cancelIdleCallback" in window) {
        window.cancelIdleCallback(idleId);
      }
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [showPrimary]);

  return (
    <div ref={ref} id="os-features">
      {showPrimary ? (
        <>
          <OsFeatures />
          {showRest ? (
            <>
              <OsSupportedWebsites />
              <OsDashboardShowcase />
              <OsPricing />
              <OsFaq />
              <OsFooter />
            </>
          ) : (
            <SectionSkeleton className="min-h-[320px]" />
          )}
        </>
      ) : (
        <SectionSkeleton className="min-h-[200px]" />
      )}
    </div>
  );
}
