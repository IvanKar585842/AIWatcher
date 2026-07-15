"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

export type SearchMonitor = {
  id: string;
  name: string;
  url: string;
  description?: string | null;
  faviconUrl?: string | null;
  status?: string;
};

interface CommandContextValue {
  collapsed: boolean;
  setCollapsed: (v: boolean) => void;
  mobileOpen: boolean;
  setMobileOpen: (v: boolean) => void;
  /** Cached monitors for header search — loaded on demand, no per-keystroke requests. */
  searchMonitors: SearchMonitor[] | null;
  searchMonitorsLoading: boolean;
  ensureSearchMonitors: () => Promise<void>;
  invalidateSearchMonitors: () => void;
}

const CommandContext = createContext<CommandContextValue | null>(null);

function toSearchMonitor(raw: Record<string, unknown>): SearchMonitor | null {
  const id = typeof raw.id === "string" ? raw.id : null;
  const name = typeof raw.name === "string" ? raw.name : null;
  const url = typeof raw.url === "string" ? raw.url : null;
  if (!id || !name || !url) return null;
  return {
    id,
    name,
    url,
    description: typeof raw.description === "string" ? raw.description : null,
    faviconUrl: typeof raw.faviconUrl === "string" ? raw.faviconUrl : null,
    status: typeof raw.status === "string" ? raw.status : undefined,
  };
}

export function CommandProvider({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchMonitors, setSearchMonitors] = useState<SearchMonitor[] | null>(null);
  const [searchMonitorsLoading, setSearchMonitorsLoading] = useState(false);
  const loadPromiseRef = useRef<Promise<void> | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem("command-nav-collapsed");
    if (stored === "true") setCollapsed(true);
  }, []);

  useEffect(() => {
    if (!mobileOpen) return;

    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setMobileOpen(false);
    }

    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [mobileOpen]);

  const invalidateSearchMonitors = useCallback(() => {
    setSearchMonitors(null);
    loadPromiseRef.current = null;
  }, []);

  useEffect(() => {
    function onUpdated() {
      invalidateSearchMonitors();
    }
    window.addEventListener("monitors-updated", onUpdated);
    return () => window.removeEventListener("monitors-updated", onUpdated);
  }, [invalidateSearchMonitors]);

  const ensureSearchMonitors = useCallback(async () => {
    if (searchMonitors) return;
    if (loadPromiseRef.current) return loadPromiseRef.current;

    setSearchMonitorsLoading(true);
    const promise = (async () => {
      try {
        const res = await fetch("/api/monitors");
        if (!res.ok) {
          setSearchMonitors([]);
          return;
        }
        const data = (await res.json()) as { monitors?: unknown[] };
        const list = Array.isArray(data.monitors) ? data.monitors : [];
        const mapped: SearchMonitor[] = [];
        for (const item of list) {
          if (!item || typeof item !== "object") continue;
          const m = toSearchMonitor(item as Record<string, unknown>);
          if (m) mapped.push(m);
        }
        setSearchMonitors(mapped);
      } catch {
        setSearchMonitors([]);
      } finally {
        setSearchMonitorsLoading(false);
        loadPromiseRef.current = null;
      }
    })();

    loadPromiseRef.current = promise;
    return promise;
  }, [searchMonitors]);

  function handleSetCollapsed(v: boolean) {
    setCollapsed(v);
    localStorage.setItem("command-nav-collapsed", String(v));
  }

  const value = useMemo(
    () => ({
      collapsed,
      setCollapsed: handleSetCollapsed,
      mobileOpen,
      setMobileOpen,
      searchMonitors,
      searchMonitorsLoading,
      ensureSearchMonitors,
      invalidateSearchMonitors,
    }),
    [
      collapsed,
      mobileOpen,
      searchMonitors,
      searchMonitorsLoading,
      ensureSearchMonitors,
      invalidateSearchMonitors,
    ]
  );

  return (
    <CommandContext.Provider value={value}>{children}</CommandContext.Provider>
  );
}

export function useCommand() {
  const ctx = useContext(CommandContext);
  if (!ctx) throw new Error("useCommand must be used within CommandProvider");
  return ctx;
}
