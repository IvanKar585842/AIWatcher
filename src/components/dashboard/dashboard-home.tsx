"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";

const CommandCenter = dynamic(
  () =>
    import("@/components/dashboard/command/command-center").then(
      (m) => m.CommandCenter
    ),
  {
    loading: () => (
      <div className="space-y-4 p-1">
        <Skeleton className="h-28 w-full rounded-2xl bg-white/[0.04]" />
        <Skeleton className="min-h-[320px] w-full rounded-2xl bg-white/[0.04]" />
      </div>
    ),
  }
);

const MonitorList = dynamic(
  () => import("@/components/dashboard/monitor-list").then((m) => m.MonitorList),
  {
    loading: () => <Skeleton className="h-64 w-full rounded-2xl bg-white/[0.04]" />,
    ssr: false,
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

export function DashboardHome({
  initialShowOnboarding = false,
}: {
  initialShowOnboarding?: boolean;
}) {
  const [showOnboarding, setShowOnboarding] = useState(initialShowOnboarding);

  useEffect(() => {
    if ("scrollRestoration" in history) {
      history.scrollRestoration = "manual";
    }
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, []);

  useEffect(() => {
    try {
      sessionStorage.setItem(ONBOARDING_CACHE_KEY, showOnboarding ? "0" : "1");
    } catch {
      /* ignore */
    }
  }, [showOnboarding]);

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
