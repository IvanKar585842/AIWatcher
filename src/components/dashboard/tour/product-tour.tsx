"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  PRODUCT_TOUR_EVENTS,
  PRODUCT_TOUR_STEPS,
  type TourStepDef,
  writeTourDoneLocal,
} from "@/lib/product-tour";
import { cn } from "@/lib/utils";

const PAD = 10;
const WAIT_MS = 4500;
const POLL_MS = 120;

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function waitForEl(selector: string, timeout = WAIT_MS): Promise<HTMLElement | null> {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const el = document.querySelector(selector) as HTMLElement | null;
    if (el) {
      const r = el.getBoundingClientRect();
      if (r.width > 2 && r.height > 2) return el;
    }
    await sleep(POLL_MS);
  }
  return null;
}

function scrollIntoViewSafe(el: HTMLElement) {
  try {
    el.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
  } catch {
    el.scrollIntoView();
  }
}

async function runPrepare(step: TourStepDef) {
  switch (step.prepare) {
    case "feed-tab":
      (document.querySelector('[data-tour="tab-feed"]') as HTMLElement | null)?.click();
      await sleep(280);
      break;
    case "assistant-tab":
      (document.querySelector('[data-tour="tab-assistant"]') as HTMLElement | null)?.click();
      await sleep(350);
      break;
    case "open-create":
      window.dispatchEvent(new CustomEvent(PRODUCT_TOUR_EVENTS.OPEN_CREATE));
      await sleep(400);
      break;
    case "close-create":
      window.dispatchEvent(new CustomEvent(PRODUCT_TOUR_EVENTS.CLOSE_CREATE));
      await sleep(200);
      break;
    case "expand-notifications": {
      const root = document.querySelector('[data-tour="settings-notifications"]');
      const btn = root?.querySelector("button[aria-expanded]") as HTMLElement | null;
      if (btn?.getAttribute("aria-expanded") === "false") {
        btn.click();
        await sleep(250);
      }
      break;
    }
    default:
      break;
  }
}

type Spotlight = { top: number; left: number; width: number; height: number };

export function ProductTour({
  onFinished,
}: {
  onFinished: () => void;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [index, setIndex] = useState(0);
  const [spotlight, setSpotlight] = useState<Spotlight | null>(null);
  const [busy, setBusy] = useState(false);
  const [tooltipPos, setTooltipPos] = useState<{ top: number; left: number }>({
    top: 80,
    left: 16,
  });
  const targetRef = useRef<HTMLElement | null>(null);
  const closingRef = useRef(false);

  const step = PRODUCT_TOUR_STEPS[index]!;
  const isLast = index === PRODUCT_TOUR_STEPS.length - 1;
  const isWelcome = !step.selector;

  const persistDone = useCallback(async () => {
    writeTourDoneLocal(true);
    try {
      await fetch("/api/user/product-tour", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ completed: true }),
      });
    } catch {
      /* localStorage already set */
    }
  }, []);

  const finish = useCallback(async () => {
    if (closingRef.current) return;
    closingRef.current = true;
    window.dispatchEvent(new CustomEvent(PRODUCT_TOUR_EVENTS.CLOSE_CREATE));
    await persistDone();
    onFinished();
  }, [onFinished, persistDone]);

  const measure = useCallback(() => {
    const el = targetRef.current;
    if (!el) {
      setSpotlight(null);
      return;
    }
    const r = el.getBoundingClientRect();
    const box: Spotlight = {
      top: Math.max(8, r.top - PAD),
      left: Math.max(8, r.left - PAD),
      width: Math.min(window.innerWidth - 16, r.width + PAD * 2),
      height: Math.min(window.innerHeight - 16, r.height + PAD * 2),
    };
    setSpotlight(box);

    const tipW = Math.min(360, window.innerWidth - 24);
    const tipH = 200;
    let top = box.top + box.height + 14;
    let left = Math.min(
      Math.max(12, box.left + box.width / 2 - tipW / 2),
      window.innerWidth - tipW - 12
    );
    if (top + tipH > window.innerHeight - 12) {
      top = Math.max(12, box.top - tipH - 12);
    }
    setTooltipPos({ top, left });
  }, []);

  const activateStep = useCallback(
    async (stepIndex: number) => {
      setBusy(true);
      setSpotlight(null);
      targetRef.current = null;

      const next = PRODUCT_TOUR_STEPS[stepIndex];
      if (!next) {
        setBusy(false);
        await finish();
        return;
      }

      try {
        if (next.route && pathname !== next.route) {
          window.dispatchEvent(new CustomEvent(PRODUCT_TOUR_EVENTS.CLOSE_CREATE));
          router.push(next.route);
          await sleep(450);
        }

        if (next.prepare === "close-create") {
          await runPrepare(next);
        } else if (next.prepare && next.prepare !== "open-create") {
          await runPrepare(next);
        }

        if (!next.selector) {
          setSpotlight(null);
          setTooltipPos({
            top: Math.max(80, window.innerHeight * 0.28),
            left: Math.max(12, (window.innerWidth - Math.min(400, window.innerWidth - 24)) / 2),
          });
          setBusy(false);
          return;
        }

        if (next.prepare === "open-create") {
          await runPrepare(next);
        }

        const el = await waitForEl(next.selector);
        if (!el) {
          // Missing target — skip forward without breaking the page
          setBusy(false);
          if (stepIndex < PRODUCT_TOUR_STEPS.length - 1) {
            setIndex(stepIndex + 1);
          } else {
            await finish();
          }
          return;
        }

        targetRef.current = el;
        scrollIntoViewSafe(el);
        await sleep(280);
        measure();
      } catch {
        /* continue gracefully */
      } finally {
        setBusy(false);
      }
    },
    [finish, measure, pathname, router]
  );

  useEffect(() => {
    void activateStep(index);
    // Only re-run when step index changes (pathname handled inside)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index]);

  useLayoutEffect(() => {
    if (!step.selector) return;
    const onResize = () => measure();
    window.addEventListener("resize", onResize);
    window.addEventListener("scroll", onResize, true);
    const id = window.setInterval(measure, 900);
    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("scroll", onResize, true);
      window.clearInterval(id);
    };
  }, [measure, step.selector, index]);

  const goNext = async () => {
    if (busy) return;
    if (step.id === "create") {
      window.dispatchEvent(new CustomEvent(PRODUCT_TOUR_EVENTS.CLOSE_CREATE));
      await sleep(180);
    }
    if (isLast) {
      await finish();
      try {
        sessionStorage.setItem("wf-open-create-after-tour", "1");
      } catch {
        /* ignore */
      }
      router.push("/dashboard/monitors");
      return;
    }
    setIndex((i) => i + 1);
  };

  const goBack = async () => {
    if (busy || index === 0) return;
    if (step.id === "create") {
      window.dispatchEvent(new CustomEvent(PRODUCT_TOUR_EVENTS.CLOSE_CREATE));
      await sleep(180);
    }
    setIndex((i) => Math.max(0, i - 1));
  };

  const tipWidth = Math.min(isWelcome ? 400 : 360, typeof window !== "undefined" ? window.innerWidth - 24 : 360);

  return (
    <div className="fixed inset-0 z-[100] pointer-events-none" aria-live="polite">
      {/* Dim + hole */}
      {spotlight ? (
        <div
          className="pointer-events-auto absolute rounded-2xl border border-cyan-400/50 shadow-[0_0_0_9999px_rgba(0,0,0,0.72)] transition-[top,left,width,height] duration-300 ease-out ring-2 ring-cyan-400/30"
          style={{
            top: spotlight.top,
            left: spotlight.left,
            width: spotlight.width,
            height: spotlight.height,
          }}
          aria-hidden
        />
      ) : (
        <div className="pointer-events-auto absolute inset-0 bg-black/70" aria-hidden />
      )}

      {/* Tooltip */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="wf-tour-title"
        className="pointer-events-auto absolute z-[101] rounded-2xl border border-cyan-400/25 bg-[#0c0c0c] p-4 shadow-[0_0_40px_-8px_rgba(34,211,238,0.35)] sm:p-5"
        style={{
          top: tooltipPos.top,
          left: tooltipPos.left,
          width: tipWidth,
          maxWidth: "calc(100vw - 24px)",
        }}
      >
        <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-cyan-500/70">
          Step {index + 1} of {PRODUCT_TOUR_STEPS.length}
        </p>
        <h2 id="wf-tour-title" className="mt-1.5 text-base font-semibold text-zinc-50 sm:text-lg">
          {step.title}
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-zinc-400">{step.body}</p>

        {isLast && (
          <p className="mt-3 text-sm font-medium text-cyan-200/90">
            You&apos;re ready. Create your first monitor.
          </p>
        )}

        <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => void finish()}
            className="min-h-10 rounded-full px-3 text-xs text-zinc-500 transition-colors hover:text-zinc-300"
          >
            Skip
          </button>
          <div className="flex items-center gap-2">
            {index > 0 && (
              <button
                type="button"
                disabled={busy}
                onClick={() => void goBack()}
                className="min-h-10 rounded-full border border-white/[0.08] bg-white/[0.03] px-4 text-sm text-zinc-300 transition-colors hover:border-cyan-400/30 disabled:opacity-50"
              >
                Back
              </button>
            )}
            <button
              type="button"
              disabled={busy}
              onClick={() => void goNext()}
              className={cn(
                "min-h-10 rounded-full border border-cyan-400/30 bg-cyan-500/15 px-5 text-sm font-medium text-cyan-100 transition-colors hover:bg-cyan-500/25 disabled:opacity-50"
              )}
            >
              {step.primaryLabel ?? (isLast ? "Finish" : "Next")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
