"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { WebsiteLogo } from "@/components/dashboard/website-logo";
import { cn, getDomainFromUrl } from "@/lib/utils";
import { useCommand, type SearchMonitor } from "./command-context";

function matchesQuery(monitor: SearchMonitor, q: string): boolean {
  const domain = getDomainFromUrl(monitor.url).toLowerCase();
  const hay = [
    monitor.name,
    monitor.description ?? "",
    monitor.url,
    domain,
    domain.replace(/^www\./, ""),
  ]
    .join(" ")
    .toLowerCase();
  return hay.includes(q);
}

export function MonitorHeaderSearch({ className }: { className?: string }) {
  const router = useRouter();
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const {
    searchMonitors,
    searchMonitorsLoading,
    ensureSearchMonitors,
  } = useCommand();

  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  const trimmed = query.trim().toLowerCase();

  const results = useMemo(() => {
    if (!trimmed || !searchMonitors) return [];
    return searchMonitors.filter((m) => matchesQuery(m, trimmed)).slice(0, 8);
  }, [searchMonitors, trimmed]);

  useEffect(() => {
    setActiveIndex(0);
  }, [trimmed]);

  useEffect(() => {
    function onPointerDown(e: PointerEvent) {
      if (!rootRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    window.addEventListener("pointerdown", onPointerDown);
    return () => window.removeEventListener("pointerdown", onPointerDown);
  }, []);

  const goTo = useCallback(
    (monitor: SearchMonitor) => {
      setOpen(false);
      setQuery("");
      router.push(`/dashboard/monitors/${monitor.id}`);
    },
    [router]
  );

  function onFocus() {
    setOpen(true);
    void ensureSearchMonitors();
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Escape") {
      setOpen(false);
      inputRef.current?.blur();
      return;
    }

    if (!open && (e.key === "ArrowDown" || e.key === "Enter")) {
      setOpen(true);
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (results.length === 0) return;
      setActiveIndex((i) => (i + 1) % results.length);
      return;
    }

    if (e.key === "ArrowUp") {
      e.preventDefault();
      if (results.length === 0) return;
      setActiveIndex((i) => (i - 1 + results.length) % results.length);
      return;
    }

    if (e.key === "Enter") {
      e.preventDefault();
      if (!trimmed) return;
      if (results[activeIndex]) {
        goTo(results[activeIndex]!);
        return;
      }
      if (results.length === 1) {
        goTo(results[0]!);
      }
    }
  }

  const showPanel = open && trimmed.length > 0;

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <Search className="pointer-events-none absolute left-3 top-1/2 z-10 h-3.5 w-3.5 -translate-y-1/2 text-zinc-600" />
      <input
        ref={inputRef}
        type="search"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={onFocus}
        onKeyDown={onKeyDown}
        placeholder="Search monitors…"
        aria-label="Search monitors by name, domain, or URL"
        aria-autocomplete="list"
        aria-controls={listId}
        aria-expanded={showPanel}
        autoComplete="off"
        className="h-9 w-44 rounded-full border border-white/[0.06] bg-white/[0.03] pl-9 pr-4 text-xs text-zinc-300 placeholder:text-zinc-600 outline-none transition-colors focus:border-cyan-400/30 focus:ring-1 focus:ring-cyan-400/20 md:w-52 lg:w-64"
      />

      {showPanel && (
        <div
          id={listId}
          role="listbox"
          className="absolute right-0 top-[calc(100%+6px)] z-50 w-[min(100vw-2rem,22rem)] overflow-hidden rounded-xl border border-white/[0.08] bg-[#0c0c0c]/95 shadow-[0_16px_40px_-12px_rgba(0,0,0,0.75)] backdrop-blur-xl"
        >
          {searchMonitorsLoading && !searchMonitors ? (
            <p className="px-3 py-3 text-xs text-zinc-500">Loading monitors…</p>
          ) : results.length === 0 ? (
            <p className="px-3 py-3 text-xs text-zinc-500">No monitors found.</p>
          ) : (
            <ul className="max-h-72 overflow-y-auto py-1">
              {results.map((monitor, index) => {
                const domain = getDomainFromUrl(monitor.url);
                const active = index === activeIndex;
                return (
                  <li key={monitor.id} role="option" aria-selected={active}>
                    <button
                      type="button"
                      className={cn(
                        "flex w-full items-center gap-2.5 px-3 py-2.5 text-left transition-colors",
                        active ? "bg-cyan-500/10" : "hover:bg-white/[0.04]"
                      )}
                      onMouseEnter={() => setActiveIndex(index)}
                      onClick={() => goTo(monitor)}
                    >
                      <WebsiteLogo
                        url={monitor.url}
                        faviconUrl={monitor.faviconUrl}
                        size={18}
                        alt=""
                        className="shrink-0 rounded"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-xs font-medium text-zinc-100">
                          {monitor.name}
                        </span>
                        <span className="mt-0.5 block truncate font-mono text-[10px] text-zinc-500">
                          {domain}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
