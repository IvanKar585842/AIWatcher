import { createHash } from "node:crypto";
import type { SourceKind, SourceRecord } from "./types";

export function fingerprintRecord(parts: Array<string | number | null | undefined>): string {
  return createHash("sha256").update(parts.map((part) => part ?? "").join("\n")).digest("hex");
}

export function makeRecord(
  input: Omit<SourceRecord, "fingerprint" | "tags"> & { tags?: string[] }
): SourceRecord {
  const tags = input.tags ?? [];
  return {
    ...input,
    tags,
    fingerprint: fingerprintRecord([
      input.id,
      input.title,
      input.content,
      input.summary,
      input.price,
      input.currency,
      input.availability,
      input.seller,
      input.variant,
      input.version,
      input.condition,
    ]),
  };
}

export interface RecordDiff {
  changed: boolean;
  decisive: boolean;
  summaryLines: string[];
}

/**
 * News and release feeds only report additions and updates.
 * Falling off a latest-N feed is not treated as deletion.
 * Marketplace removals are confirmed only when the caller says the result set is complete.
 */
export function compareSourceRecords(
  previous: SourceRecord[] | null | undefined,
  current: SourceRecord[] | null | undefined,
  confirmRemovals: boolean
): RecordDiff | null {
  if (!previous?.length || !current) return null;
  const prev = new Map(previous.map((record) => [record.id, record]));
  const next = new Map(current.map((record) => [record.id, record]));
  const lines: string[] = [];

  for (const record of current) {
    const prior = prev.get(record.id);
    if (!prior) {
      lines.push(addedLine(record));
      continue;
    }
    if (prior.fingerprint === record.fingerprint) continue;
    lines.push(updatedLine(prior, record));
  }

  if (confirmRemovals) {
    for (const record of previous) {
      if (!next.has(record.id)) lines.push(`Removed: ${record.title ?? record.id}`);
    }
  }

  return {
    changed: lines.length > 0,
    decisive: true,
    summaryLines: lines.length > 0 ? lines.slice(0, 12) : ["No meaningful source changes"],
  };
}

function addedLine(record: SourceRecord): string {
  if (record.sourceType === "release") return `New release: ${record.version ?? record.title ?? record.id}`;
  if (record.sourceType === "news_article" || record.sourceType === "news_feed" || record.sourceType === "news_search") {
    return `New article: ${record.title ?? record.id}`;
  }
  if (record.sourceType === "changelog") return `Changelog update: ${record.title ?? record.id}`;
  return `New item: ${record.title ?? record.id}`;
}

function updatedLine(previous: SourceRecord, current: SourceRecord): string {
  if (previous.version !== current.version && current.version) {
    return `Version changed from ${previous.version ?? "unknown"} to ${current.version}`;
  }
  if (previous.price !== current.price || previous.currency !== current.currency) {
    return `Price changed from ${money(previous)} to ${money(current)} (${current.title ?? current.id})`;
  }
  if (previous.title !== current.title && current.title) return `Headline changed to ${current.title}`;
  if ((previous.content ?? "") !== (current.content ?? "")) {
    return `Article updated: ${current.title ?? current.id}`;
  }
  return `Updated: ${current.title ?? current.id}`;
}

function money(record: SourceRecord): string {
  if (record.price == null || !record.currency) return "price unavailable";
  return `${record.price} ${record.currency}`;
}

export function renderRecords(records: SourceRecord[]): string {
  return records
    .slice()
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((record) =>
      [
        `type=${record.sourceType}`,
        `id=${record.id}`,
        `title=${record.title ?? ""}`,
        `version=${record.version ?? ""}`,
        `price=${record.price ?? ""}`,
        `currency=${record.currency ?? ""}`,
        `availability=${record.availability ?? ""}`,
        `content=${(record.content ?? record.summary ?? "").slice(0, 500)}`,
      ].join("\n")
    )
    .join("\n---\n");
}

export function readSourceRecords(metadata: Record<string, unknown> | null | undefined): SourceRecord[] | null {
  const value = metadata?.sourceRecords;
  if (!Array.isArray(value)) return null;
  return value.filter((item) => item && typeof item === "object" && typeof (item as SourceRecord).id === "string") as SourceRecord[];
}

export function sourceKindOf(value: unknown): SourceKind | null {
  const allowed: SourceKind[] = [
    "product",
    "marketplace_search",
    "marketplace_category",
    "news_feed",
    "news_search",
    "news_article",
    "release",
    "changelog",
    "webpage",
  ];
  return allowed.includes(value as SourceKind) ? (value as SourceKind) : null;
}
