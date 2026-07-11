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
