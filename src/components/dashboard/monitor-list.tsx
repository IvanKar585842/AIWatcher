"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { motion } from "framer-motion";
import { Radar } from "lucide-react";
import { MonitorCard, type MonitorWithCount } from "@/components/dashboard/monitor-card";
import { CreateMonitorDialog, type MonitorPrefill } from "@/components/dashboard/create-monitor-dialog";
import { MonitorsEmptyState } from "@/components/dashboard/monitors-empty-state";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { MonitorGridSkeleton } from "@/components/dashboard/command/dashboard-skeletons";
import { useToast } from "@/components/ui/os-toast";

type LoadState = "loading" | "ready" | "error";

/** Parse monitors list from API. Empty array is valid success data. */
function parseMonitorsPayload(body: unknown): MonitorWithCount[] | null {
  if (!body || typeof body !== "object") return null;
  const record = body as Record<string, unknown>;

  if (Array.isArray(record.monitors)) {
    return record.monitors as MonitorWithCount[];
  }

  if (record.data && typeof record.data === "object" && !Array.isArray(record.data)) {
    const data = record.data as Record<string, unknown>;
    if (Array.isArray(data.monitors)) {
      return data.monitors as MonitorWithCount[];
    }
  }

  if (record.success === true) {
    return [];
  }

  return null;
}

export function MonitorList({
  embedded,
  showHeaderCreate = true,
  emptyStateShowCreate = true,
  emptyVariant = "dashboard",
}: {
  embedded?: boolean;
  showHeaderCreate?: boolean;
  emptyStateShowCreate?: boolean;
  emptyVariant?: "dashboard" | "monitors";
}) {
  const { isLoaded, isSignedIn } = useAuth();
  const { toast } = useToast();
  const [monitors, setMonitors] = useState<MonitorWithCount[]>([]);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [duplicatePrefill, setDuplicatePrefill] = useState<MonitorPrefill | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const requestIdRef = useRef(0);
  const mountedRef = useRef(true);

  const fetchMonitors = useCallback(async () => {
    const requestId = ++requestIdRef.current;

    try {
      const res = await fetch("/api/monitors", {
        credentials: "same-origin",
        headers: { Accept: "application/json" },
      });

      if (!mountedRef.current || requestId !== requestIdRef.current) return;

      let body: unknown = null;
      try {
        body = await res.json();
      } catch {
        body = null;
      }

      // Prefer parsed monitors whenever present — [] is onboarding, not an error
      const parsed = parseMonitorsPayload(body);
      if (res.ok && parsed !== null) {
        setMonitors(parsed);
        setLoadState("ready");
        return;
      }

      // Successful HTTP with unexpected shape → treat as empty onboarding
      if (res.ok) {
        setMonitors([]);
        setLoadState("ready");
        return;
      }

      // Real failure only
      setMonitors([]);
      setLoadState("error");
    } catch {
      if (!mountedRef.current || requestId !== requestIdRef.current) return;
      setMonitors([]);
      setLoadState("error");
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!isLoaded) return;

    if (!isSignedIn) {
      setMonitors([]);
      setLoadState("ready");
      return;
    }

    setLoadState("loading");
    void fetchMonitors();
  }, [isLoaded, isSignedIn, fetchMonitors]);

  useEffect(() => {
    if (!isSignedIn) return;

    const onUpdate = () => {
      void fetchMonitors();
    };

    window.addEventListener("monitors-updated", onUpdate);
    return () => window.removeEventListener("monitors-updated", onUpdate);
  }, [isSignedIn, fetchMonitors]);

  function handleCreated(_monitorId: string) {
    void fetchMonitors();
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
    void fetchMonitors();
  }

  async function confirmDelete() {
    if (!pendingDeleteId) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/monitors/${pendingDeleteId}`, { method: "DELETE" });
      if (!res.ok) {
        toast("Could not delete monitor. Please try again.", "error");
        return;
      }
      setPendingDeleteId(null);
      toast("Monitor deleted", "success");
      void fetchMonitors();
      window.dispatchEvent(new CustomEvent("monitors-updated"));
    } catch {
      toast("Could not delete monitor. Please try again.", "error");
    } finally {
      setDeleting(false);
    }
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

  if (!isLoaded || loadState === "loading") {
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
              {monitors.length !== 1 ? "s" : ""} active
            </p>
          </div>
        </div>
        {showHeaderCreate && monitors.length > 0 && (
          <CreateMonitorDialog
            onCreated={handleCreated}
            variant="os"
            prefillRequest={duplicatePrefill}
            onPrefillConsumed={() => setDuplicatePrefill(null)}
            triggerLabel="+ Create Monitor"
            triggerClassName="h-11 px-6 text-sm font-medium shadow-[0_0_32px_-8px_rgba(34,211,238,0.55)]"
          />
        )}
      </div>

      {loadState === "error" ? (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border border-red-500/20 bg-red-500/5 px-6 py-12 text-center"
        >
          <p className="text-sm font-medium text-red-300">
            Unable to load your monitors. Please try again.
          </p>
          <button
            type="button"
            onClick={() => {
              setLoadState("loading");
              void fetchMonitors();
            }}
            className="mt-4 min-h-11 rounded-full border border-white/[0.08] px-5 py-2 text-xs text-zinc-300 transition-colors hover:border-cyan-400/30 hover:text-cyan-300"
          >
            Retry
          </button>
        </motion.div>
      ) : monitors.length === 0 ? (
        <MonitorsEmptyState
          variant={emptyVariant}
          onCreated={handleCreated}
          showCreateButton={emptyStateShowCreate}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {monitors.map((monitor, i) => (
            <MonitorCard
              key={monitor.id}
              monitor={monitor}
              index={i}
              onPause={() => togglePause(monitor.id, monitor.status)}
              onDelete={() => setPendingDeleteId(monitor.id)}
              onDuplicate={() => handleDuplicate(monitor)}
            />
          ))}
        </div>
      )}

      <ConfirmDialog
        open={pendingDeleteId !== null}
        onOpenChange={(open) => {
          if (!open && !deleting) setPendingDeleteId(null);
        }}
        title="Delete monitor?"
        description="Are you sure you want to delete this monitor? This action cannot be undone."
        confirmLabel="Delete Monitor"
        cancelLabel="Cancel"
        tone="danger"
        loading={deleting}
        onConfirm={() => void confirmDelete()}
      />
    </div>
  );
}
