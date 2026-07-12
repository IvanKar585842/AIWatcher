"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { CommandCenter } from "@/components/dashboard/command/command-center";
import { Skeleton } from "@/components/ui/skeleton";

const MonitorList = dynamic(
  () => import("@/components/dashboard/monitor-list").then((m) => m.MonitorList),
  {
    loading: () => <Skeleton className="h-64 w-full rounded-2xl bg-white/[0.04]" />,
  }
);

const OnboardingFlow = dynamic(
  () =>
    import("@/components/dashboard/onboarding/onboarding-flow").then((m) => m.OnboardingFlow),
  {
    loading: () => (
      <div className="space-y-4 p-1">
        <Skeleton className="h-40 w-full rounded-2xl bg-white/[0.04]" />
        <Skeleton className="h-64 w-full rounded-2xl bg-white/[0.04]" />
      </div>
    ),
  }
);

const ONBOARDING_CACHE_KEY = "wf-onboarding-done";

function readOnboardingCache(): boolean | null {
  try {
    const v = sessionStorage.getItem(ONBOARDING_CACHE_KEY);
    if (v === "1") return false; // done → no onboarding
    if (v === "0") return true; // needs onboarding
  } catch {
    /* ignore */
  }
  return null;
}

export function DashboardHome() {
  const [loading, setLoading] = useState(true);
  const [showOnboarding, setShowOnboarding] = useState(false);

  useEffect(() => {
    if ("scrollRestoration" in history) {
      history.scrollRestoration = "manual";
    }
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, []);

  useEffect(() => {
    if (loading) return;
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [loading, showOnboarding]);

  useEffect(() => {
    const cached = readOnboardingCache();
    // Returning users: skip skeleton gate using session cache
    if (cached === false) {
      setShowOnboarding(false);
      setLoading(false);
    } else if (cached === true) {
      setShowOnboarding(true);
      setLoading(false);
    }

    const controller = new AbortController();

    fetch("/api/user/onboarding", { signal: controller.signal })
      .then(async (res) => {
        if (!res.ok) return null;
        return res.json();
      })
      .then((data) => {
        if (!data) {
          setShowOnboarding(false);
          try {
            sessionStorage.setItem(ONBOARDING_CACHE_KEY, "1");
          } catch {
            /* ignore */
          }
          return;
        }
        const needs = !data.onboardingCompleted && !data.hasMonitors;
        setShowOnboarding(needs);
        try {
          sessionStorage.setItem(ONBOARDING_CACHE_KEY, needs ? "0" : "1");
        } catch {
          /* ignore */
        }
      })
      .catch((err) => {
        if (err.name !== "AbortError") setShowOnboarding(false);
      })
      .finally(() => setLoading(false));

    return () => controller.abort();
  }, []);

  if (loading) {
    return (
      <div className="space-y-4 p-1">
        <Skeleton className="h-40 w-full rounded-2xl bg-white/[0.04]" />
        <Skeleton className="h-64 w-full rounded-2xl bg-white/[0.04]" />
      </div>
    );
  }

  if (showOnboarding) {
    return (
      <OnboardingFlow
        onComplete={() => {
          try {
            sessionStorage.setItem(ONBOARDING_CACHE_KEY, "1");
          } catch {
            /* ignore */
          }
          setShowOnboarding(false);
        }}
      />
    );
  }

  return (
    <div className="space-y-8">
      <CommandCenter />
      <MonitorList />
    </div>
  );
}
