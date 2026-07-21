"use client";

import { useEffect, useRef } from "react";

/**
 * Like setInterval, but only ticks while the document is visible.
 * Immediately invokes `fn` once on mount (optional via runOnMount).
 */
export function useVisibleInterval(
  fn: () => void,
  ms: number,
  options?: { runOnMount?: boolean; enabled?: boolean }
) {
  const fnRef = useRef(fn);
  fnRef.current = fn;
  const runOnMount = options?.runOnMount ?? true;
  const enabled = options?.enabled ?? true;

  useEffect(() => {
    if (!enabled) return;

    if (runOnMount) {
      fnRef.current();
    }

    const id = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        fnRef.current();
      }
    }, ms);

    return () => window.clearInterval(id);
  }, [ms, runOnMount, enabled]);
}
