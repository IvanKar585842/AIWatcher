/**
 * Lightweight visual fingerprinting without external image deps.
 * Captures a fixed-size grayscale grid from Playwright and compares grids.
 */

export const VISUAL_VIEWPORT = { width: 1280, height: 720 } as const;
export const VISUAL_GRID_SIZE = 48;
/** Ignore diffs below this % (anti-aliasing / minor rendering noise) */
export const VISUAL_NOISE_THRESHOLD_PERCENT = 1.5;
/** Meaningful visual change threshold */
export const VISUAL_CHANGE_THRESHOLD_PERCENT = 2.5;

export type VisualFingerprint = number[]; // 0-255 averages, length = GRID_SIZE^2

export interface VisualRegionDiff {
  name: string;
  percent: number;
}

/**
 * Splits the global 48x48 fingerprint into a 3x4 grid.
 * This locates a change on the screenshot. It does not identify DOM elements.
 */
export function compareVisualRegions(
  previous: VisualFingerprint | null | undefined,
  current: VisualFingerprint | null | undefined,
  ignore: Array<"top" | "bottom"> = []
): { percent: number; changed: boolean; regions: VisualRegionDiff[] } {
  const overall = compareVisualFingerprints(previous, current);
  if (!previous?.length || !current?.length || previous.length !== current.length) {
    return { ...overall, regions: [] };
  }
  const cols = 3;
  const rows = 4;
  const cellW = VISUAL_GRID_SIZE / cols;
  const cellH = VISUAL_GRID_SIZE / rows;
  const names = ["top-left", "top-center", "top-right", "upper-left", "upper-center", "upper-right", "lower-left", "lower-center", "lower-right", "bottom-left", "bottom-center", "bottom-right"];
  const regions: VisualRegionDiff[] = [];
  let considered = 0;
  let diffSum = 0;
  for (let row = 0; row < rows; row++) {
    if (ignore.includes("top") && row === 0) continue;
    if (ignore.includes("bottom") && row === rows - 1) continue;
    for (let col = 0; col < cols; col++) {
      let local = 0;
      let count = 0;
      for (let y = row * cellH; y < (row + 1) * cellH; y++) {
        for (let x = col * cellW; x < (col + 1) * cellW; x++) {
          const index = y * VISUAL_GRID_SIZE + x;
          local += Math.abs(previous[index] - current[index]);
          count += 1;
        }
      }
      const percent = (local / (count * 255)) * 100;
      regions.push({ name: names[row * cols + col] ?? `region-${row}-${col}`, percent: Math.round(percent * 100) / 100 });
      diffSum += local;
      considered += count;
    }
  }
  const percent = considered ? (diffSum / (considered * 255)) * 100 : overall.percent;
  const hot = regions.filter((region) => region.percent >= 8);
  return {
    percent: Math.round(percent * 100) / 100,
    changed: percent >= VISUAL_CHANGE_THRESHOLD_PERCENT && hot.length > 0,
    regions: hot,
  };
}

export function compareVisualFingerprints(
  previous: VisualFingerprint | null | undefined,
  current: VisualFingerprint | null | undefined
): { percent: number; changed: boolean } {
  if (!previous?.length || !current?.length || previous.length !== current.length) {
    return { percent: current?.length ? 100 : 0, changed: Boolean(current?.length) };
  }

  let diffSum = 0;
  for (let i = 0; i < previous.length; i++) {
    diffSum += Math.abs(previous[i] - current[i]);
  }

  const percent = (diffSum / (previous.length * 255)) * 100;

  if (percent < VISUAL_NOISE_THRESHOLD_PERCENT) {
    return { percent, changed: false };
  }

  return {
    percent: Math.round(percent * 100) / 100,
    changed: percent >= VISUAL_CHANGE_THRESHOLD_PERCENT,
  };
}

/** Playwright page.evaluate script body — returns number[] fingerprint */
export const VISUAL_FINGERPRINT_SCRIPT = `(() => {
  const size = ${VISUAL_GRID_SIZE};
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return [];
  ctx.drawImage(document.documentElement, 0, 0, window.innerWidth, window.innerHeight, 0, 0, size, size);
  const data = ctx.getImageData(0, 0, size, size).data;
  const out = [];
  for (let i = 0; i < data.length; i += 4) {
    out.push(Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]));
  }
  return out;
})()`;
