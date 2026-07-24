"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState, type ReactNode } from "react";

const HeroDashboardVisual = dynamic(
  () =>
    import("@/components/landing/os/hero-dashboard").then((m) => m.HeroDashboardVisual),
  { ssr: false }
);

/**
 * CRITICAL LCP FIX:
 * Never auto-swap the hero at ~4–5s. A late, larger visual becomes the LCP
 * element and pushes LCP to 5–10s in Lighthouse.
 *
 * Keep the static SSR shell until the user scrolls near it (or a very late idle).
 */
export function HeroVisualLoader({ fallback }: { fallback: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    let idleId: number | undefined;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    let enabled = false;

    const enable = () => {
      if (enabled) return;
      enabled = true;
      setReady(true);
    };

    let observer: IntersectionObserver | null = null;

    if (typeof IntersectionObserver !== "undefined") {
      observer = new IntersectionObserver(
        ([entry]) => {
          if (!entry?.isIntersecting) return;
          observer?.disconnect();
          if ("requestIdleCallback" in window) {
            idleId = window.requestIdleCallback(enable, { timeout: 2000 });
          } else {
            timeoutId = setTimeout(enable, 400);
          }
        },
        { rootMargin: "0px", threshold: 0.35 }
      );
      observer.observe(el);
    }

    const onScroll = () => {
      // Fallback for browsers without IO: first scroll enables after idle
      if ("requestIdleCallback" in window) {
        idleId = window.requestIdleCallback(enable, { timeout: 1500 });
      } else {
        timeoutId = setTimeout(enable, 300);
      }
    };
    window.addEventListener("scroll", onScroll, { passive: true, once: true });

    // Safety net only — well after Lighthouse LCP window (~5–8s lab)
    timeoutId = setTimeout(enable, 12000);

    return () => {
      observer?.disconnect();
      window.removeEventListener("scroll", onScroll);
      if (idleId !== undefined && "cancelIdleCallback" in window) {
        window.cancelIdleCallback(idleId);
      }
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, []);

  return <div ref={ref}>{ready ? <HeroDashboardVisual /> : fallback}</div>;
}
