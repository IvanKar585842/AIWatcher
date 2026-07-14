"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import {
  PRODUCT_TOUR_EVENTS,
  readTourDoneLocal,
  writeTourDoneLocal,
} from "@/lib/product-tour";

/**
 * Loads the product tour chunk only when the tour should run.
 * Otherwise adds near-zero cost (event listeners + deferred status check).
 */
const ProductTourLazy = dynamic(
  () => import("./product-tour").then((m) => m.ProductTour),
  { ssr: false }
);

export function ProductTourGate() {
  const pathname = usePathname();
  const [active, setActive] = useState(false);
  const [tourKey, setTourKey] = useState(0);
  const startingRef = useRef(false);
  const checkedRef = useRef(false);

  const startTour = useCallback(() => {
    if (startingRef.current && active) return;
    startingRef.current = true;
    setTourKey((k) => k + 1);
    setActive(true);
  }, [active]);

  const stopTour = useCallback(() => {
    startingRef.current = false;
    setActive(false);
  }, []);

  const restartTour = useCallback(() => {
    writeTourDoneLocal(false);
    void fetch("/api/user/product-tour", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ completed: false }),
    }).catch(() => undefined);

    startingRef.current = false;
    setActive(false);
    // Remount tour from welcome after a tick so Skip→Start works immediately
    window.setTimeout(() => {
      startingRef.current = true;
      setTourKey((k) => k + 1);
      setActive(true);
    }, 40);
  }, []);

  const fetchTourCompleted = useCallback(async (): Promise<boolean | null> => {
    try {
      const res = await fetch("/api/user/product-tour", { credentials: "same-origin" });
      if (!res.ok) return null;
      const data = (await res.json()) as { completed?: boolean };
      return Boolean(data.completed);
    } catch {
      return null;
    }
  }, []);

  const waitForDashboardReady = useCallback(async (timeoutMs = 10000) => {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      if (document.querySelector('[data-tour="global-map"]')) return true;
      await new Promise((r) => setTimeout(r, 350));
    }
    return Boolean(document.querySelector('[data-tour="global-map"]'));
  }, []);

  const considerAutoStart = useCallback(async () => {
    if (active || startingRef.current) return;

    // Prefer server truth; localStorage is offline fallthrough after a confirmed complete
    const remote = await fetchTourCompleted();
    if (remote === true) {
      writeTourDoneLocal(true);
      return;
    }
    // API failure / unauthorized — do not interrupt existing sessions
    if (remote === null) return;
    // remote === false
    if (readTourDoneLocal()) {
      // Stale local "done" vs server "not done" (new account on shared browser): trust server
      writeTourDoneLocal(false);
    }

    if (pathname !== "/dashboard") return;

    const ready = await waitForDashboardReady();
    if (!ready) return;
    if (startingRef.current) return;
    startTour();
  }, [active, fetchTourCompleted, pathname, startTour, waitForDashboardReady]);

  // Manual restart from Settings → Help → Product Tour
  useEffect(() => {
    const onStart = () => restartTour();
    window.addEventListener(PRODUCT_TOUR_EVENTS.START, onStart);
    return () => window.removeEventListener(PRODUCT_TOUR_EVENTS.START, onStart);
  }, [restartTour]);

  // After onboarding wizard completes
  useEffect(() => {
    const onMaybe = () => {
      checkedRef.current = false;
      void considerAutoStart();
    };
    window.addEventListener(PRODUCT_TOUR_EVENTS.MAYBE_START, onMaybe);
    return () => window.removeEventListener(PRODUCT_TOUR_EVENTS.MAYBE_START, onMaybe);
  }, [considerAutoStart]);

  // Deferred first check — does not block dashboard paint
  useEffect(() => {
    if (active || checkedRef.current) return;
    if (pathname !== "/dashboard") return;

    // Fast path: already completed locally AND we'll confirm remotely when idle
    checkedRef.current = true;

    let idleId: number | undefined;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    const run = () => void considerAutoStart();

    if (typeof window !== "undefined" && "requestIdleCallback" in window) {
      idleId = window.requestIdleCallback(run, { timeout: 4500 });
    } else {
      timeoutId = setTimeout(run, 3000);
    }

    return () => {
      if (idleId !== undefined && "cancelIdleCallback" in window) {
        window.cancelIdleCallback(idleId);
      }
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [active, considerAutoStart, pathname]);

  if (!active) return null;

  return <ProductTourLazy key={tourKey} onFinished={stopTour} />;
}
