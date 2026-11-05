import { MonitoringMode } from "@prisma/client";
import { createHash } from "crypto";
import { hasMeaningfulChange, hashContent, normalizeForComparison } from "./content-cleaner";
import type { FetchResult } from "./fetcher";
import { monitorLog } from "./logger";
import { comparePageStructures, extractPageStructure, type StructureDiff } from "./structural-diff";
import { compareStructuredFields, readStructured } from "./structured-compare";
import { compareMarketplaceProducts, readMarketplaceProducts } from "./marketplace/compare-products";
import { compareAssets, type AssetEvidence, type AssetSnapshot } from "./asset-content";
import { comparablePair, comparePageProfiles, extractPageProfile, readPageProfile, type WatchScope } from "./page-profile";
import { compareSourceRecords, readSourceRecords } from "./sources/records";
import {
  compareVisualFingerprints,
  compareVisualRegions,
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
  summaryLines?: string[];
  evidence?: AssetEvidence[];
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
    if (!prevFp?.length || !currFp?.length) {
      if (input.previousHash === currentHash) {
        return { changed: false, reason: "hash_match", currentHash, visualDiffPercent: 0 };
      }
      return { changed: true, reason: "screenshot_diff", currentHash, visualDiffPercent: null };
    }
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

  const assetDiff = compareAssets(readAssets(input.previousMetadata), readAssets(input.current.metadata));
  const assetLines = assetDiff.evidence
    .filter((item) => item.type !== "asset_unverified")
    .map(describeAssetEvidence);

  if (input.previousHash === currentHash && assetDiff.changed) {
    return {
      changed: true,
      reason: "content_diff",
      currentHash,
      summaryLines: assetLines,
      evidence: assetDiff.evidence,
    };
  }

  if (input.previousHash === currentHash && !assetDiff.changed) {
    const visual = optionalVisualDiff(input);
    if (visual?.changed) {
      return {
        changed: true,
        reason: "screenshot_diff",
        currentHash,
        visualDiffPercent: visual.percent,
        summaryLines: visual.lines,
        evidence: assetDiff.evidence,
      };
    }
    return { changed: false, reason: "hash_match", currentHash, visualDiffPercent: visual?.percent ?? null };
  }

  const confirmRemovals = input.current.metadata.resultComplete !== false;
  const marketplace = compareMarketplaceProducts(
    readMarketplaceProducts(input.previousMetadata),
    readMarketplaceProducts(input.current.metadata),
    confirmRemovals
  );
  if (marketplace?.decisive) {
    return {
      changed: marketplace.changed,
      reason: marketplace.changed ? "content_diff" : "noise_filtered",
      currentHash,
      summaryLines: marketplace.summaryLines,
    };
  }

  const records = compareSourceRecords(
    readSourceRecords(input.previousMetadata),
    readSourceRecords(input.current.metadata),
    confirmRemovals
  );
  if (records?.decisive) {
    return {
      changed: records.changed,
      reason: records.changed ? "content_diff" : "noise_filtered",
      currentHash,
      summaryLines: records.summaryLines,
    };
  }

  const scope = readWatchScope(input.current.metadata);
  const keywords = Array.isArray(input.current.metadata.keywords)
    ? input.current.metadata.keywords.filter((item): item is string => typeof item === "string")
    : [];
  const universal = comparePageProfiles(
    readPageProfile(input.previousMetadata) ??
      (input.previousCleanedHtml ? extractPageProfile(input.previousCleanedHtml, input.previousCleanedHtml) : null),
    readPageProfile(input.current.metadata) ?? extractPageProfile(input.current.rawHtml, input.current.cleanedHtml),
    scope,
    keywords
  );
  if (universal && scope !== "page") {
    return {
      changed: universal.changed,
      reason: universal.changed ? "content_diff" : "noise_filtered",
      currentHash,
      summaryLines: universal.summaryLines,
    };
  }
  const pageLines = [...assetLines, ...(universal?.changed ? universal.summaryLines : [])];

  const structured = compareStructuredFields({
    mode: input.mode,
    previous: readStructured(input.previousMetadata),
    current: readStructured(input.current.metadata),
  });

  if (structured?.decisive) {
    return {
      changed: structured.changed,
      reason: structured.changed ? "content_diff" : "noise_filtered",
      currentHash,
      summaryLines: structured.summaryLines,
    };
  }

  const advisory = structured && !structured.decisive ? structured.summaryLines : [];

  if (input.mode === MonitoringMode.ENTIRE_PAGE && input.previousCleanedHtml) {
    const focused = comparablePair(input.previousCleanedHtml, input.current.cleanedHtml);
    const structureDiff = comparePageStructures(
      focused?.previous ?? input.previousCleanedHtml,
      focused?.current ?? input.current.cleanedHtml
    );

    const textChanged = hasMeaningfulChange(
      focused ? focused.previous.replace(/<[^>]+>/g, " ") : input.previousText,
      focused ? focused.current.replace(/<[^>]+>/g, " ") : input.current.extractedText
    );
    if (!structureDiff.changed && !textChanged && advisory.length === 0 && pageLines.length === 0) {
      return {
        changed: false,
        reason: "noise_filtered",
        currentHash,
        structureDiff,
      };
    }

    if (structureDiff.changed || textChanged || advisory.length > 0 || pageLines.length > 0) {
      return {
        changed: true,
        reason: structureDiff.changed ? "structure_diff" : "content_diff",
        currentHash,
        structureDiff,
        summaryLines: pageLines.length > 0 ? pageLines : advisory.length > 0 ? advisory : structureDiff.summaryLines,
        evidence: assetDiff.evidence,
      };
    }

    return { changed: false, reason: "noise_filtered", currentHash, structureDiff };
  }

  if (!hasMeaningfulChange(input.previousText, input.current.extractedText) && advisory.length === 0 && pageLines.length === 0) {
    return { changed: false, reason: "noise_filtered", currentHash };
  }

  return {
    changed: true,
    reason: "content_diff",
    currentHash,
    summaryLines: pageLines.length > 0 ? pageLines : advisory,
    evidence: assetDiff.evidence,
  };
}

function readAssets(metadata: Record<string, unknown> | null | undefined): AssetSnapshot[] | null {
  const value = metadata?.assets;
  if (!Array.isArray(value)) return null;
  return value as AssetSnapshot[];
}

function describeAssetEvidence(item: AssetEvidence): string {
  if (item.type === "file_replaced") return `File replaced at ${item.url}: hash ${item.previous} → ${item.current}`;
  if (item.type === "image_similar") return `Image changed at ${item.url}: content differs, appearance is similar`;
  if (item.type === "image_relocated") return `Same image content moved from ${item.previous} to ${item.current}`;
  return `Image replaced at ${item.url}: content hash ${item.previous} → ${item.current}`;
}

function readWatchScope(metadata: Record<string, unknown>): WatchScope {
  const value = metadata.watchScope;
  const allowed: WatchScope[] = ["page", "section", "keyword", "links", "structured", "images", "numbers", "tables", "files"];
  return allowed.includes(value as WatchScope) ? (value as WatchScope) : "page";
}

function optionalVisualDiff(input: ComparisonInput): { changed: boolean; percent: number; lines: string[] } | null {
  const previous = readFingerprint(input.previousMetadata);
  const current = readFingerprint(input.current.metadata);
  if (!previous?.length || !current?.length) return null;
  const ignore: Array<"top" | "bottom"> =
    input.current.metadata.visualIgnore === "top" || input.current.metadata.visualIgnore === "bottom"
      ? [input.current.metadata.visualIgnore]
      : [];
  const regions = compareVisualRegions(previous, current, ignore);
  const where = regions.regions.slice(0, 3).map((region) => `${region.name} ~${region.percent}%`).join(", ");
  return {
    changed: regions.changed,
    percent: regions.percent,
    lines: [
      where
        ? `Screenshot region changed (${where}). This is a grid on the screenshot, not a named page element.`
        : `Visible page changed by about ${regions.percent}%`,
    ],
  };
}

export function hashScreenshotBuffer(buffer: Buffer): string {
  return createHash("sha256").update(buffer).digest("hex");
}
