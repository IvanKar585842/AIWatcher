import { extractTextFromHtml, normalizeForComparison } from "./content-cleaner";

export interface PageStructure {
  headings: string[];
  buttons: string[];
  links: string[];
  images: string[];
  sections: string[];
  textSample: string;
}

export interface StructureDiff {
  changed: boolean;
  score: number;
  addedHeadings: string[];
  removedHeadings: string[];
  addedButtons: string[];
  removedButtons: string[];
  addedImages: string[];
  removedImages: string[];
  addedSections: string[];
  removedSections: string[];
  textChanged: boolean;
  summaryLines: string[];
}

function uniqueNormalized(items: string[], limit = 40): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of items) {
    const n = normalizeForComparison(item).slice(0, 120);
    if (!n || n.length < 2 || seen.has(n)) continue;
    seen.add(n);
    out.push(n);
    if (out.length >= limit) break;
  }
  return out;
}

function setDiff(prev: string[], next: string[]) {
  const prevSet = new Set(prev);
  const nextSet = new Set(next);
  const added = next.filter((x) => !prevSet.has(x));
  const removed = prev.filter((x) => !nextSet.has(x));
  return { added, removed };
}

/** Extract a stable structure signature from cleaned HTML for ENTIRE_PAGE comparison. */
export function extractPageStructure(html: string): PageStructure {
  const headings = uniqueNormalized(
    [...html.matchAll(/<h[1-6][^>]*>([\s\S]*?)<\/h[1-6]>/gi)].map((m) =>
      m[1].replace(/<[^>]+>/g, " ")
    )
  );

  const buttons = uniqueNormalized([
    ...[...html.matchAll(/<button[^>]*>([\s\S]*?)<\/button>/gi)].map((m) =>
      m[1].replace(/<[^>]+>/g, " ")
    ),
    ...[...html.matchAll(/<(?:a|div|span)[^>]*(?:role=["']button["']|btn)[^>]*>([\s\S]*?)<\//gi)].map(
      (m) => m[1].replace(/<[^>]+>/g, " ")
    ),
  ]);

  const links = uniqueNormalized(
    [...html.matchAll(/href=(["'])([^"']+)\1/gi)].map((m) => m[2]),
    60
  );

  const images = uniqueNormalized(
    [
      ...[...html.matchAll(/\[IMAGE:([^\]]+)\]/gi)].map((m) => m[1]),
      ...[...html.matchAll(/src=(["'])([^"']+)\1/gi)].map((m) => m[2]),
      ...[...html.matchAll(/alt=(["'])([^"']*)\1/gi)].map((m) => m[2]),
    ].filter((s) => s && !s.startsWith("data:")),
    50
  );

  const sections = uniqueNormalized(
    [
      ...[...html.matchAll(/<(?:section|article|main|nav|header|footer)[^>]*(?:id|class)=(["'])([^"']+)\1/gi)].map(
        (m) => m[2]
      ),
      ...[...html.matchAll(/<(?:section|article)[^>]*>/gi)].map((_, i) => `section-${i}`),
    ],
    40
  );

  const textSample = normalizeForComparison(extractTextFromHtml(html)).slice(0, 4000);

  return { headings, buttons, links, images, sections, textSample };
}

export function comparePageStructures(
  previousHtml: string,
  currentHtml: string
): StructureDiff {
  const prev = extractPageStructure(previousHtml);
  const next = extractPageStructure(currentHtml);

  const headings = setDiff(prev.headings, next.headings);
  const buttons = setDiff(prev.buttons, next.buttons);
  const images = setDiff(prev.images, next.images);
  const sections = setDiff(prev.sections, next.sections);
  const links = setDiff(prev.links, next.links);

  const textChanged =
    prev.textSample !== next.textSample &&
    Math.abs(prev.textSample.length - next.textSample.length) /
      Math.max(prev.textSample.length, next.textSample.length, 1) >=
      0.01;

  const changeWeight =
    headings.added.length * 3 +
    headings.removed.length * 3 +
    sections.added.length * 4 +
    sections.removed.length * 4 +
    buttons.added.length * 2 +
    buttons.removed.length * 2 +
    images.added.length * 2 +
    images.removed.length * 2 +
    links.added.length +
    links.removed.length +
    (textChanged ? 3 : 0);

  const score = Math.min(100, changeWeight * 4);
  const changed = score >= 8;

  const summaryLines: string[] = [];
  if (sections.added.length) summaryLines.push(`Added sections: ${sections.added.slice(0, 3).join(", ")}`);
  if (sections.removed.length)
    summaryLines.push(`Removed sections: ${sections.removed.slice(0, 3).join(", ")}`);
  if (headings.added.length) summaryLines.push(`New headings: ${headings.added.slice(0, 3).join(", ")}`);
  if (headings.removed.length)
    summaryLines.push(`Removed headings: ${headings.removed.slice(0, 3).join(", ")}`);
  if (buttons.added.length || buttons.removed.length)
    summaryLines.push("Button labels or CTAs changed");
  if (images.added.length || images.removed.length) summaryLines.push("Images changed");
  if (textChanged) summaryLines.push("Visible text content changed");
  if (summaryLines.length === 0 && changed) summaryLines.push("Page structure changed");

  return {
    changed,
    score,
    addedHeadings: headings.added,
    removedHeadings: headings.removed,
    addedButtons: buttons.added,
    removedButtons: buttons.removed,
    addedImages: images.added,
    removedImages: images.removed,
    addedSections: sections.added,
    removedSections: sections.removed,
    textChanged,
    summaryLines,
  };
}

export function buildChangePackageForAI(params: {
  structureDiff?: StructureDiff | null;
  textDiffLines?: string[];
  visualDiffPercent?: number | null;
  mode: string;
  url: string;
  monitorName: string;
  userPrompt?: string;
}): string {
  const lines: string[] = [
    `Monitor: ${params.monitorName}`,
    `URL: ${params.url}`,
    `Mode: ${params.mode}`,
  ];

  if (params.userPrompt?.trim()) {
    lines.push(`User instructions: ${params.userPrompt.trim()}`);
  }

  if (params.visualDiffPercent != null) {
    lines.push(`Visual difference: ${params.visualDiffPercent.toFixed(2)}% of pixels changed`);
  }

  if (params.structureDiff) {
    lines.push("Detected structural changes:");
    for (const line of params.structureDiff.summaryLines.slice(0, 8)) {
      lines.push(`- ${line}`);
    }
  }

  if (params.textDiffLines && params.textDiffLines.length > 0) {
    lines.push("Text changes:");
    for (const line of params.textDiffLines.slice(0, 12)) {
      lines.push(`- ${line}`);
    }
  }

  return lines.join("\n");
}
