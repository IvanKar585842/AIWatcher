export interface CaptureSummary {
  headline: string;
  lines: string[];
}

export function shouldWaitForInterval(input: {
  force?: boolean;
  errorCount: number;
  lastCheckedAt: Date | null;
  now: Date;
  intervalMs: number;
}): boolean {
  if (input.force) return false;
  if (input.errorCount > 0) return false;
  if (!input.lastCheckedAt) return false;
  const earliest = input.lastCheckedAt.getTime() + input.intervalMs;
  return input.now.getTime() + 2_000 < earliest;
}

export function summarizeCapture(
  metadata: unknown,
  extractedText?: string | null
): CaptureSummary {
  const meta = asRecord(metadata);
  const lines: string[] = [];
  const structured = asRecord(meta?.structured);
  const listings = structured?.listingsFound === true;
  const items = asRecords(structured?.items);
  const records = asRecords(meta?.sourceRecords);
  const prices = asRecords(structured?.prices);

  const kind = captureLabel(meta?.captureType);
  if (kind) lines.push(kind);

  const opened = openLabel(meta);
  if (opened) lines.push(opened);

  if (listings) {
    lines.push(items.length > 0 ? `${items.length} catalog items` : "Catalog page");
    for (const item of items.slice(0, 3)) {
      const title = text(item.title);
      if (!title) continue;
      const price = priceLabel(item.price, item.currency);
      lines.push(price ? `${title} — ${price}` : title);
    }
  } else if (records.length > 0) {
    lines.push(`${records.length} records`);
    for (const record of records.slice(0, 3)) {
      const title = text(record.title) ?? text(record.version);
      if (title) lines.push(title);
    }
  } else {
    const price = prices[0];
    const shown = priceLabel(price?.raw ?? price?.value, price?.currency);
    if (shown) lines.push(`Price ${shown}`);
    const availability = text(structured?.availability);
    if (availability && availability !== "unknown") {
      lines.push(availability.replaceAll("_", " "));
    }
    const title = text(structured?.title);
    if (title) lines.push(title);
  }

  if (lines.length < 2) {
    const excerpt = (extractedText ?? "").replace(/\s+/g, " ").trim().slice(0, 180);
    if (excerpt) lines.push(excerpt);
  }

  return {
    headline: lines[0] ?? "Page captured",
    lines: lines.slice(0, 6),
  };
}

export function describeCheck(input: {
  status: string;
  reason?: string | null;
  capture?: CaptureSummary | null;
}): { title: string; lines: string[] } {
  const lines = input.capture?.lines ?? [];
  if (input.status === "baseline") {
    return { title: "First snapshot saved", lines };
  }
  if (input.status === "no_change") {
    return {
      title:
        input.reason === "noise_filtered"
          ? "Only noise changed"
          : "No meaningful change",
      lines,
    };
  }
  if (input.status === "change_detected") {
    return { title: "A change was saved", lines };
  }
  if (input.status === "skipped") {
    return { title: skipTitle(input.reason), lines };
  }
  return { title: "Check finished", lines };
}

function skipTitle(reason?: string | null): string {
  if (reason === "lock_held") return "A check is already running";
  if (reason === "capacity") return "Too many checks are running. Try again in a moment";
  if (reason === "interval_not_elapsed") return "The scheduled interval has not elapsed";
  if (reason?.startsWith("status_")) return "This monitor is not active";
  if (reason === "not_found") return "Monitor was not found";
  return "Check was skipped";
}

function captureLabel(value: unknown): string | null {
  const type = text(value);
  if (!type) return null;
  const labels: Record<string, string> = {
    "github-releases": "Software releases",
    "amazon_creators_api": "Amazon API",
    ebay_browse_api: "eBay API",
    etsy: "Etsy API",
    shopify: "Shopify catalog",
    rss: "RSS feed",
    atom: "Atom feed",
    news_feed: "News feed",
  };
  return labels[type] ?? null;
}

function openLabel(meta: Record<string, unknown> | null): string | null {
  if (!meta) return null;
  const launches = typeof meta.browserLaunches === "number" ? meta.browserLaunches : 0;
  const strategy = text(meta.fetchStrategy);
  if (launches > 0 || strategy === "dynamic" || strategy === "advanced") {
    return "Opened in a browser";
  }
  if (strategy === "http" || meta.browserLaunched === false) return "Opened with HTTP";
  return null;
}

function priceLabel(value: unknown, currency: unknown): string | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return text(currency) ? `${value} ${text(currency)}` : String(value);
  }
  const raw = text(value);
  if (!raw) return null;
  const unit = text(currency);
  return unit && !raw.includes(unit) ? `${raw} ${unit}` : raw;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function asRecords(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is Record<string, unknown> => Boolean(asRecord(item)));
}

function text(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}
