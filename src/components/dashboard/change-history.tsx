"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Eye, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { HistoryEmptyState } from "@/components/dashboard/history-empty-state";
import { OsInput } from "@/components/dashboard/os/os-primitives";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MODE_LABELS } from "@/lib/constants";
import { cn, formatDate, formatRelativeTime } from "@/lib/utils";
import type { MonitoringMode } from "@prisma/client";

interface ChangeItem {
  id: string;
  summary: string;
  emoji: string;
  importance: string;
  category: string;
  oldValue: string | null;
  newValue: string | null;
  bulletPoints?: string[];
  analysisStatus?: string;
  createdAt: string;
  changeType?: string;
  visualDiffPercent?: number | null;
  hasScreenshots?: boolean;
  monitor: { id: string; name: string; url: string; mode?: string };
}

function importanceDotClass(importance: string) {
  switch (importance) {
    case "CRITICAL":
      return "border-red-400 bg-red-500 shadow-[0_0_12px_rgba(248,113,113,0.55)]";
    case "HIGH":
      return "border-amber-300 bg-amber-400 shadow-[0_0_10px_rgba(251,191,36,0.5)]";
    case "MEDIUM":
      return "border-cyan-300 bg-cyan-400 shadow-[0_0_10px_rgba(34,211,238,0.45)]";
    default:
      return "border-white/20 bg-zinc-700";
  }
}

function importanceVariant(imp: string) {
  switch (imp) {
    case "CRITICAL":
      return "destructive" as const;
    case "HIGH":
      return "warning" as const;
    case "MEDIUM":
      return "default" as const;
    default:
      return "secondary" as const;
  }
}

function changeTypeLabel(change: ChangeItem): string {
  if (change.hasScreenshots) return "Visual";
  if (change.monitor.mode && MODE_LABELS[change.monitor.mode as MonitoringMode]) {
    return MODE_LABELS[change.monitor.mode as MonitoringMode];
  }
  return change.category.replace(/_/g, " ");
}

export function ChangeHistory() {
  const [changes, setChanges] = useState<ChangeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [importance, setImportance] = useState("all");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const hasLoadedOnce = useRef(false);

  const fetchChanges = useCallback(async (signal?: AbortSignal) => {
    // Soft refresh after first load — avoid full skeleton flicker
    if (!hasLoadedOnce.current) setLoading(true);

    const params = new URLSearchParams({ page: String(page), limit: "20" });
    if (query) params.set("query", query);
    if (category !== "all") params.set("category", category);
    if (importance !== "all") params.set("importance", importance);

    try {
      const res = await fetch(`/api/changes?${params}`, { signal });
      if (!res.ok) return;
      const data = await res.json();
      setChanges(data.changes ?? []);
      setTotalPages(data.pagination?.totalPages ?? 1);
      hasLoadedOnce.current = true;
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [query, category, importance, page]);

  useEffect(() => {
    const controller = new AbortController();
    const debounce = setTimeout(() => fetchChanges(controller.signal), 300);
    return () => {
      clearTimeout(debounce);
      controller.abort();
    };
  }, [fetchChanges]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-600" />
          <OsInput
            placeholder="Search what changed..."
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(1);
            }}
            className="pl-9"
          />
        </div>
        <Select value={category} onValueChange={(v) => { setCategory(v); setPage(1); }}>
          <SelectTrigger className="w-full sm:w-40">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {["PRICE", "CONTENT", "JOBS", "POLICY", "CONTACT_INFO", "PRODUCT", "DOCUMENTATION", "FEATURES", "OTHER"].map(
              (cat) => (
                <SelectItem key={cat} value={cat}>
                  {cat.replace("_", " ")}
                </SelectItem>
              )
            )}
          </SelectContent>
        </Select>
        <Select value={importance} onValueChange={(v) => { setImportance(v); setPage(1); }}>
          <SelectTrigger className="w-full sm:w-36">
            <SelectValue placeholder="Importance" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Levels</SelectItem>
            {["CRITICAL", "HIGH", "MEDIUM", "LOW"].map((imp) => (
              <SelectItem key={imp} value={imp}>
                {imp}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      ) : changes.length === 0 ? (
        <HistoryEmptyState filtered={Boolean(query || category !== "all" || importance !== "all")} />
      ) : (
        <div className="relative space-y-0 pl-4 sm:pl-6">
          <div className="absolute bottom-2 left-[11px] top-2 w-px bg-gradient-to-b from-cyan-500/40 via-white/[0.08] to-transparent sm:left-[15px]" />
          {changes.map((change, index) => {
            const bullets = (change.bulletPoints ?? []).filter(Boolean).slice(0, 3);
            return (
              <Link key={change.id} href={`/dashboard/changes/${change.id}`} className="block">
                <div className="relative pb-5">
                  <span
                    className={cn(
                      "absolute left-[-9px] top-6 h-2.5 w-2.5 rounded-full border sm:left-[-5px]",
                      importanceDotClass(change.importance)
                    )}
                    title={`${change.importance} importance`}
                  />
                  <div className="ml-4 rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 transition-colors hover:border-cyan-500/20 hover:bg-cyan-500/[0.03] active:bg-cyan-500/[0.05] sm:ml-6">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                      <div className="flex min-w-0 items-start gap-3">
                        <span className="text-2xl" aria-hidden>
                          {change.emoji}
                        </span>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-medium text-zinc-100">{change.monitor.name}</span>
                            <Badge variant="outline" className="text-xs capitalize">
                              {changeTypeLabel(change)}
                            </Badge>
                            <Badge variant={importanceVariant(change.importance)} className="text-xs">
                              {change.importance}
                            </Badge>
                            {change.hasScreenshots && (
                              <span className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-wider text-cyan-400/80">
                                <Eye className="h-3 w-3" />
                                Screenshots
                              </span>
                            )}
                          </div>

                          <p className="mt-2 text-[11px] font-medium uppercase tracking-wider text-zinc-600">
                            What changed?
                          </p>
                          <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-zinc-300">
                            {change.summary}
                          </p>

                          {bullets.length > 0 && (
                            <ul className="mt-2 space-y-1">
                              {bullets.map((point) => (
                                <li
                                  key={point}
                                  className="flex gap-2 text-xs leading-relaxed text-zinc-500"
                                >
                                  <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-cyan-400/70" />
                                  <span className="line-clamp-1">{point}</span>
                                </li>
                              ))}
                            </ul>
                          )}

                          {(change.oldValue || change.newValue) && (
                            <div className="mt-2 flex flex-wrap gap-3 text-xs">
                              {change.oldValue && (
                                <span className="text-red-400/90 line-through">{change.oldValue}</span>
                              )}
                              {change.newValue && (
                                <span className="font-medium text-emerald-400">{change.newValue}</span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center justify-between gap-3 border-t border-white/[0.04] pt-2 sm:block sm:border-0 sm:pt-0 sm:text-right">
                        {index === 0 && (
                          <p className="font-mono text-[10px] uppercase tracking-wider text-cyan-500/70 sm:mb-1">
                            Latest
                          </p>
                        )}
                        <div className="sm:ml-auto">
                          <p className="text-xs font-medium text-zinc-400">
                            {formatRelativeTime(change.createdAt)}
                          </p>
                          <p className="mt-0.5 font-mono text-[10px] text-zinc-600">
                            {formatDate(change.createdAt)}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex justify-center gap-2 pt-4">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="min-h-10 rounded border border-white/[0.08] px-4 py-2 text-sm text-zinc-400 disabled:opacity-50"
          >
            Previous
          </button>
          <span className="px-3 py-2 text-sm text-zinc-500">
            Page {page} of {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="min-h-10 rounded border border-white/[0.08] px-4 py-2 text-sm text-zinc-400 disabled:opacity-50"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
