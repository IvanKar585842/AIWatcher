/** How many raw snapshots to retain. Official marketplace API content is not kept as a long archive. */
export function snapshotKeepCount(captureType: unknown): number {
  if (
    captureType === "amazon_creators_api" ||
    captureType === "ebay_browse_api" ||
    captureType === "etsy"
  ) {
    return 2;
  }
  return 10;
}
