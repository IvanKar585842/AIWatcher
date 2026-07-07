"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { motion } from "framer-motion";
import { Radar } from "lucide-react";
import { MonitorCard, type MonitorWithCount } from "@/components/dashboard/monitor-card";
import { CreateMonitorDialog, type MonitorPrefill } from "@/components/dashboard/create-monitor-dialog";
import { MonitorsEmptyState } from "@/components/dashboard/monitors-empty-state";
import { MonitorGridSkeleton } from "@/components/dashboard/command/dashboard-skeletons";
import { fetchApi } from "@/lib/fetch-api";

function isRealFailure(status: number): boolean {
  return status === 0 || status >= 500;
}

export function MonitorList({ embedded }: { embedded?: boolean }) {
  const { isLoaded, isSignedIn } = useAuth();
  const [monitors, setMonitors] = useState<MonitorWithCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [duplicatePrefill, setDuplicatePrefill] = useState<MonitorPrefill | null>(null);

  const fetchMonitors = useCallback(async () => {
    setError(false);
    const result = await fetchApi<{ monitors: MonitorWithCount[] }>("/api/monitors");

    if (!result.success) {
      // Only show error for genuine server/network failures — never for empty lists or client errors
      setError(isRealFailure(result.status));
      setMonitors([]);
      setLoading(false);
      return;
    }

    setMonitors(Array.isArray(result.data.monitors) ? result.data.monitors : []);
    setError(false);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!isLoaded) return;

    if (!isSignedIn) {
      setMonitors([]);
      setLoading(false);
      setError(false);
      return;
    }

    setLoading(true);
    fetchMonitors();
  }, [isLoaded, isSignedIn, fetchMonitors]);

  useEffect(() => {
    if (!isSignedIn) return;
    const onUpdate = () => fetchMonitors();
    window.addEventListener("monitors-updated", onUpdate);
    return () => window.removeEventListener("monitors-updated", onUpdate);
  }, [isSignedIn, fetchMonitors]);

  function handleCreated(_monitorId: string) {
    fetchMonitors();
    window.dispatchEvent(new CustomEvent("monitors-updated"));
  }

  async function togglePause(id: string, currentStatus: string) {
    await fetch(`/api/monitors/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status: currentStatus === "ACTIVE" ? "PAUSED" : "ACTIVE",
      }),
    });
    fetchMonitors();
  }

  async function deleteMonitor(id: string) {
    if (!confirm("Delete this monitor and all its history?")) return;
    await fetch(`/api/monitors/${id}`, { method: "DELETE" });
    fetchMonitors();
  }

  function handleDuplicate(monitor: MonitorWithCount) {
    setDuplicatePrefill({
      name: `${monitor.name} (copy)`,
      url: "",
      mode: monitor.mode,
      selector: monitor.selector ?? "",
      keywords: monitor.keywords.join(", "),
      interval: monitor.interval,
      notificationMethod: monitor.notificationMethod,
      respectRobots: monitor.respectRobots,
    });
  }

  if (!isLoaded || loading) {
    return (
      <div className={embedded ? "space-y-6" : "space-y-6 px-4 pb-8 lg:px-6"}>
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 animate-pulse rounded-lg bg-white/[0.04]" />
          <div className="space-y-2">
            <div className="h-2 w-24 animate-pulse rounded bg-white/[0.04]" />
            <div className="h-3 w-32 animate-pulse rounded bg-white/[0.04]" />
          </div>
        </div>
        <MonitorGridSkeleton />
      </div>
    );
  }

  return (
    <div className={embedded ? "space-y-6" : "space-y-6 px-4 pb-8 lg:px-6"}>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-cyan-400/20 bg-cyan-500/10">
            <Radar className="h-4 w-4 text-cyan-400" />
          </div>
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-cyan-500/60">
              Surveillance Grid
            </p>
            <p className="text-sm text-zinc-400">
              <span className="font-medium text-zinc-200">{monitors.length}</span> monitor
              {monitors.length !== 1 ? "s" : ""} deployed
            </p>
          </div>
        </div>
        <CreateMonitorDialog
          onCreated={handleCreated}
          variant="os"
          prefillRequest={duplicatePrefill}
          onPrefillConsumed={() => setDuplicatePrefill(null)}
          triggerLabel="+ Create Monitor"
          triggerClassName="h-11 px-6 text-sm font-medium shadow-[0_0_32px_-8px_rgba(34,211,238,0.55)]"
        />
      </div>

      {error ? (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border border-red-500/20 bg-red-500/5 px-6 py-12 text-center"
        >
          <p className="text-sm font-medium text-red-300">Failed to load monitors</p>
          <p className="mt-1 text-xs text-zinc-600">Check your connection and try again.</p>
          <button
            type="button"
            onClick={() => {
              setLoading(true);
              fetchMonitors();
            }}
            className="mt-4 rounded-full border border-white/[0.08] px-4 py-2 text-xs text-zinc-400 transition-colors hover:text-cyan-300"
          >
            Retry
          </button>
        </motion.div>
      ) : monitors.length === 0 ? (
        <MonitorsEmptyState onCreated={handleCreated} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {monitors.map((monitor, i) => (
            <MonitorCard
              key={monitor.id}
              monitor={monitor}
              index={i}
              onPause={() => togglePause(monitor.id, monitor.status)}
              onDelete={() => deleteMonitor(monitor.id)}
              onDuplicate={() => handleDuplicate(monitor)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
