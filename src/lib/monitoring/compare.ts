import { MonitoringMode } from "@prisma/client";
import { createHash } from "crypto";
import { hasMeaningfulChange, hashContent, normalizeForComparison } from "./content-cleaner";
import type { FetchResult } from "./fetcher";
import { monitorLog } from "./logger";

export interface ComparisonInput {
  monitorId: string;
  mode: MonitoringMode;
  previousHash: string;
  previousText: string;
  current: FetchResult;
}

export interface ComparisonResult {
  changed: boolean;
  reason: "hash_match" | "noise_filtered" | "content_diff" | "screenshot_diff";
  currentHash: string;
}

export function computeContentHash(mode: MonitoringMode, result: FetchResult): string {
  if (mode === MonitoringMode.VISUAL_CHANGES || mode === MonitoringMode.SCREENSHOT_DIFF) {
    const screenshotHash = result.metadata.screenshotHash;
    if (typeof screenshotHash === "string" && screenshotHash.length > 0) {
      return screenshotHash;
    }
  }

  if (mode === MonitoringMode.TEXT_CHANGES) {
    return hashContent(result.extractedText);
  }

  if (mode === MonitoringMode.PRICE_DETECTION || mode === MonitoringMode.KEYWORD_DETECTION) {
    return hashContent(normalizeForComparison(result.extractedText));
  }

  return hashContent(result.cleanedHtml);
}

export function compareSnapshots(input: ComparisonInput): ComparisonResult {
  const currentHash = computeContentHash(input.mode, input.current);

  monitorLog({
    step: "comparison_start",
    monitorId: input.monitorId,
    mode: input.mode,
    message: "Comparing snapshots",
    data: {
      previousHash: input.previousHash.slice(0, 16),
      currentHash: currentHash.slice(0, 16),
      previousTextLength: input.previousText.length,
      currentTextLength: input.current.extractedText.length,
    },
  });

  if (input.previousHash === currentHash) {
    return { changed: false, reason: "hash_match", currentHash };
  }

  const visualMode =
    input.mode === MonitoringMode.VISUAL_CHANGES ||
    input.mode === MonitoringMode.SCREENSHOT_DIFF;

  if (visualMode) {
    return { changed: true, reason: "screenshot_diff", currentHash };
  }

  if (!hasMeaningfulChange(input.previousText, input.current.extractedText)) {
    return { changed: false, reason: "noise_filtered", currentHash };
  }

  return { changed: true, reason: "content_diff", currentHash };
}

export function hashScreenshotBuffer(buffer: Buffer): string {
  return createHash("sha256").update(buffer).digest("hex");
}
