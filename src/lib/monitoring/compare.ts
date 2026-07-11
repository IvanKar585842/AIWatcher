import { MonitoringMode } from "@prisma/client";
import { createHash } from "crypto";
import { hasMeaningfulChange, hashContent, normalizeForComparison } from "./content-cleaner";
import type { FetchResult } from "./fetcher";
import { monitorLog } from "./logger";
import { comparePageStructures, extractPageStructure, type StructureDiff } from "./structural-diff";
import {
  compareVisualFingerprints,
  type VisualFingerprint,
} from "./visual-compare";

export interface ComparisonInput {
  monitorId: string;
  mode: MonitoringMode;
  previousHash: string;
  previousText: string;
  previousCleanedHtml?: string;
  previousMetadata?: Record<string, unknown> | null;
  current: FetchResult;
}

export interface ComparisonResult {
  changed: boolean;
  reason:
    | "hash_match"
    | "noise_filtered"
    | "content_diff"
    | "screenshot_diff"
    | "structure_diff"
    | "visual_noise";
  currentHash: string;
  structureDiff?: StructureDiff | null;
  visualDiffPercent?: number | null;
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

  if (mode === MonitoringMode.ENTIRE_PAGE) {
    const structure = extractPageStructure(result.cleanedHtml);
    const signature = [
      structure.headings.join("|"),
      structure.buttons.join("|"),
      structure.sections.join("|"),
      structure.images.join("|"),
      structure.textSample.slice(0, 8000),
    ].join("\n");
    return hashContent(signature || result.cleanedHtml);
  }

  return hashContent(result.cleanedHtml);
}

function readFingerprint(meta: Record<string, unknown> | null | undefined): VisualFingerprint | null {
  const fp = meta?.visualFingerprint;
  if (Array.isArray(fp) && fp.every((n) => typeof n === "number")) {
    return fp as number[];
  }
  return null;
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

  const visualMode =
    input.mode === MonitoringMode.VISUAL_CHANGES ||
    input.mode === MonitoringMode.SCREENSHOT_DIFF;

  if (visualMode) {
    const prevFp = readFingerprint(input.previousMetadata as Record<string, unknown> | null);
    const currFp = readFingerprint(input.current.metadata as Record<string, unknown>);
    const visual = compareVisualFingerprints(prevFp, currFp);

    if (!visual.changed && input.previousHash === currentHash) {
      return {
        changed: false,
        reason: "hash_match",
        currentHash,
        visualDiffPercent: visual.percent,
      };
    }

    if (!visual.changed) {
      return {
        changed: false,
        reason: "visual_noise",
        currentHash,
        visualDiffPercent: visual.percent,
      };
    }

    return {
      changed: true,
      reason: "screenshot_diff",
      currentHash,
      visualDiffPercent: visual.percent,
    };
  }

  if (input.previousHash === currentHash) {
    return { changed: false, reason: "hash_match", currentHash };
  }

  if (input.mode === MonitoringMode.ENTIRE_PAGE && input.previousCleanedHtml) {
    const structureDiff = comparePageStructures(
      input.previousCleanedHtml,
      input.current.cleanedHtml
    );

    if (!structureDiff.changed && !hasMeaningfulChange(input.previousText, input.current.extractedText)) {
      return {
        changed: false,
        reason: "noise_filtered",
        currentHash,
        structureDiff,
      };
    }

    if (structureDiff.changed || hasMeaningfulChange(input.previousText, input.current.extractedText)) {
      return {
        changed: true,
        reason: structureDiff.changed ? "structure_diff" : "content_diff",
        currentHash,
        structureDiff,
      };
    }

    return { changed: false, reason: "noise_filtered", currentHash, structureDiff };
  }

  if (!hasMeaningfulChange(input.previousText, input.current.extractedText)) {
    return { changed: false, reason: "noise_filtered", currentHash };
  }

  return { changed: true, reason: "content_diff", currentHash };
}

export function hashScreenshotBuffer(buffer: Buffer): string {
  return createHash("sha256").update(buffer).digest("hex");
}
