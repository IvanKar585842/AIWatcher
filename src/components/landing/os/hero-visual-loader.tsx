"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState, type ReactNode } from "react";

const HeroDashboardVisual = dynamic(
  () =>
    import("@/components/landing/os/hero-dashboard").then((m) => m.HeroDashboardVisual),
  { ssr: false }
);

/** Defer heavy framer-motion/canvas hero until idle; SSR fallback paints immediately. */
export function HeroVisualLoader({ fallback }: { fallback: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    let idleId: number | undefined;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    const enable = () => setReady(true);

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          observer.disconnect();
          if ("requestIdleCallback" in window) {
            idleId = window.requestIdleCallback(enable, { timeout: 1800 });
          } else {
            timeoutId = setTimeout(enable, 400);
          }
        }
      },
      { rootMargin: "80px" }
    );

    observer.observe(el);
    timeoutId = setTimeout(enable, 3000);

    return () => {
      observer.disconnect();
      if (idleId !== undefined && "cancelIdleCallback" in window) {
        window.cancelIdleCallback(idleId);
      }
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, []);

  return <div ref={ref}>{ready ? <HeroDashboardVisual /> : fallback}</div>;
}
