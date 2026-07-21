"use client";

import useSWR, { type SWRConfiguration } from "swr";
import { useVisibleInterval } from "@/hooks/use-visible-interval";

export const DASHBOARD_BOOTSTRAP_KEY = "/api/dashboard/bootstrap";

export type DashboardBootstrapUser = {
  id: string;
  email: string;
  name: string | null;
  role: string;
  isAdmin: boolean;
  plan: string;
  onboardingCompleted: boolean;
};

export type DashboardBootstrapStats = {
  totalMonitors: number;
  activeMonitors: number;
  pausedMonitors: number;
  errorMonitors: number;
  changesToday: number;
  importantAlerts: number;
  importantAlertChanges: Array<{
    id: string;
    summary: string;
    emoji: string;
    importance: string;
    createdAt: string;
    monitor: { name: string };
  }>;
  aiAccuracy: number;
  monitoringHealth: number;
  avgResponseTime: number;
  recentChanges: Array<{
    id: string;
    summary: string;
    emoji: string;
    importance: string;
    createdAt: string;
    monitor: { name: string; url: string };
  }>;
  recentNotifications: Array<{
    id: string;
    channel: string;
    status: string;
    createdAt: string;
    change: {
      id: string;
      summary: string;
      emoji: string;
      monitor: { name: string };
    };
  }>;
  monitors: Array<{
    id: string;
    name: string;
    url: string;
    faviconUrl?: string | null;
    status: string;
    lastChangedAt: string | null;
    _count?: { changes: number };
  }>;
  lean?: boolean;
};

export type DashboardBootstrap = {
  user: DashboardBootstrapUser;
  stats: DashboardBootstrapStats;
};

async function jsonFetcher<T>(url: string): Promise<T> {
  const res = await fetch(url, {
    credentials: "same-origin",
    headers: { Accept: "application/json" },
  });
  if (!res.ok) {
    throw new Error(`Request failed: ${res.status}`);
  }
  return res.json() as Promise<T>;
}

const defaultConfig: SWRConfiguration = {
  revalidateOnFocus: false,
  revalidateOnReconnect: true,
  dedupingInterval: 15_000,
  keepPreviousData: true,
};

/** Shared by sidebar + command center — one network request, SWR dedupes. */
export function useDashboardBootstrap(options?: { refreshMs?: number }) {
  const swr = useSWR<DashboardBootstrap>(
    DASHBOARD_BOOTSTRAP_KEY,
    jsonFetcher,
    defaultConfig
  );

  useVisibleInterval(
    () => {
      void swr.mutate();
    },
    options?.refreshMs ?? 45_000,
    { runOnMount: false }
  );

  return swr;
}

export function useFeedNotifications(enabled: boolean) {
  return useSWR<{ notifications: DashboardBootstrapStats["recentNotifications"] }>(
    enabled ? "/api/notifications?lean=1&limit=20" : null,
    jsonFetcher,
    {
      ...defaultConfig,
      dedupingInterval: 20_000,
    }
  );
}
