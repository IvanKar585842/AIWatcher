"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState, type ReactNode } from "react";

const HeroDashboardVisual = dynamic(
  () =>
    import("@/components/landing/os/hero-dashboard").then((m) => m.HeroDashboardVisual),
  { ssr: false }
);

/**
 * Keep SSR fallback through LCP; load framer/canvas only after load + idle
 * (or first scroll / long fallback).
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

    const scheduleIdle = () => {
      if ("requestIdleCallback" in window) {
        idleId = window.requestIdleCallback(enable, { timeout: 5000 });
      } else {
        timeoutId = setTimeout(enable, 1200);
      }
    };

    const onScroll = () => {
      window.removeEventListener("scroll", onScroll);
      scheduleIdle();
    };

    window.addEventListener("scroll", onScroll, { passive: true, once: true });

    if (document.readyState === "complete") {
      scheduleIdle();
    } else {
      window.addEventListener("load", scheduleIdle, { once: true });
    }

    // Hard fallback so premium visual still appears
    timeoutId = setTimeout(enable, 4500);

    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("load", scheduleIdle);
      if (idleId !== undefined && "cancelIdleCallback" in window) {
        window.cancelIdleCallback(idleId);
      }
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, []);

  return <div ref={ref}>{ready ? <HeroDashboardVisual /> : fallback}</div>;
}
