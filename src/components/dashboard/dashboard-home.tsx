"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { SWRConfig } from "swr";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/os-toast";
import { PRODUCT_TOUR_EVENTS } from "@/lib/product-tour";
import {
  DASHBOARD_BOOTSTRAP_KEY,
  type DashboardBootstrap,
} from "@/hooks/use-dashboard-bootstrap";

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
  initialBootstrap = null,
}: {
  initialShowOnboarding?: boolean;
  initialBootstrap?: DashboardBootstrap | null;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const [showOnboarding, setShowOnboarding] = useState(initialShowOnboarding);

  useEffect(() => {
    if ("scrollRestoration" in history) {
      history.scrollRestoration = "manual";
    }
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, []);

  useEffect(() => {
    if (searchParams.get("checkout") !== "success") return;
    toast("Payment successful — your plan will update in a moment.", "success");
    router.replace("/dashboard");
  }, [searchParams, router, toast]);

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
          window.dispatchEvent(new CustomEvent(PRODUCT_TOUR_EVENTS.MAYBE_START));
        }}
      />
    );
  }

  return (
    <SWRConfig
      value={
        initialBootstrap
          ? { fallback: { [DASHBOARD_BOOTSTRAP_KEY]: initialBootstrap } }
          : undefined
      }
    >
      <div className="space-y-8">
        <CommandCenter initialBootstrap={initialBootstrap} />
        <MonitorList deferInitialFetch />
      </div>
    </SWRConfig>
  );
}
