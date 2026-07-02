"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatRelativeTime } from "@/lib/utils";

interface ChangeItem {
  id: string;
  summary: string;
  emoji: string;
  importance: string;
  category: string;
  oldValue: string | null;
  newValue: string | null;
  createdAt: string;
  monitor: { id: string; name: string; url: string };
}

export function ChangeHistory() {
  const [changes, setChanges] = useState<ChangeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [importance, setImportance] = useState("all");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const fetchChanges = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: "20" });
    if (query) params.set("query", query);
    if (category !== "all") params.set("category", category);
    if (importance !== "all") params.set("importance", importance);

    const res = await fetch(`/api/changes?${params}`);
    const data = await res.json();
    setChanges(data.changes ?? []);
    setTotalPages(data.pagination?.totalPages ?? 1);
    setLoading(false);
  }, [query, category, importance, page]);

  useEffect(() => {
    const debounce = setTimeout(fetchChanges, 300);
    return () => clearTimeout(debounce);
  }, [fetchChanges]);

  const importanceVariant = (imp: string) => {
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
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search changes..."
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
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      ) : changes.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No changes found.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {changes.map((change) => (
            <Link key={change.id} href={`/dashboard/changes/${change.id}`}>
              <Card className="hover:shadow-md transition-shadow cursor-pointer">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3 min-w-0">
                      <span className="text-2xl">{change.emoji}</span>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium">{change.monitor.name}</span>
                          <Badge variant="outline" className="text-xs">
                            {change.category.replace("_", " ")}
                          </Badge>
                          <Badge variant={importanceVariant(change.importance)} className="text-xs">
                            {change.importance}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                          {change.summary}
                        </p>
                        {(change.oldValue || change.newValue) && (
                          <div className="flex gap-4 mt-2 text-xs">
                            {change.oldValue && (
                              <span className="text-red-500 line-through">{change.oldValue}</span>
                            )}
                            {change.newValue && (
                              <span className="text-green-600 font-medium">{change.newValue}</span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                    <span className="text-xs text-muted-foreground shrink-0">
                      {formatRelativeTime(change.createdAt)}
                    </span>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex justify-center gap-2 pt-4">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-3 py-1 text-sm rounded border disabled:opacity-50"
          >
            Previous
          </button>
          <span className="px-3 py-1 text-sm text-muted-foreground">
            Page {page} of {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="px-3 py-1 text-sm rounded border disabled:opacity-50"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
