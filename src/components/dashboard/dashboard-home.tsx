"use client";

import { useEffect, useState } from "react";
import { CommandCenter } from "@/components/dashboard/command/command-center";
import { MonitorList } from "@/components/dashboard/monitor-list";
import { OnboardingFlow } from "@/components/dashboard/onboarding/onboarding-flow";
import { Skeleton } from "@/components/ui/skeleton";

export function DashboardHome() {
  const [loading, setLoading] = useState(true);
  const [showOnboarding, setShowOnboarding] = useState(false);

  useEffect(() => {
    const controller = new AbortController();

    fetch("/api/user/onboarding", { signal: controller.signal })
      .then(async (res) => {
        if (!res.ok) return null;
        return res.json();
      })
      .then((data) => {
        if (!data) {
          setShowOnboarding(false);
          return;
        }
        // Show only when incomplete AND zero monitors (server also heals existing users)
        setShowOnboarding(!data.onboardingCompleted && !data.hasMonitors);
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
    return <OnboardingFlow onComplete={() => setShowOnboarding(false)} />;
  }

  return (
    <div className="space-y-8">
      <CommandCenter />
      <MonitorList />
    </div>
  );
}
