/**
 * Mocked tests for file hashes, visual regions, and JavaScript-shell detection.
 * No live downloads and no claim that every website behaves this way.
 *
 * Usage: npx tsx scripts/test-asset-engine.ts
 */
import { compareSnapshots } from "../src/lib/monitoring/compare";
import { MonitoringMode } from "@prisma/client";
import {
  averageHash,
  captureAssets,
  compareAssets,
  encodeRgbPng,
  hamming,
  MAX_IMAGE_BYTES,
} from "../src/lib/monitoring/asset-content";
import { httpResponseNeedsBrowser } from "../src/lib/monitoring/render-need";
import { probeSelector } from "../src/lib/monitoring/selector-probe";
import { compareVisualRegions } from "../src/lib/monitoring/visual-compare";

const results: Array<{ name: string; ok: boolean; detail: string }> = [];
function record(name: string, ok: boolean, detail: string) {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"} ${name} — ${detail}`);
}

function png(red: number, green = 20, blue = 20): Buffer {
  const rgb = new Uint8Array(8 * 8 * 3);
  for (let i = 0; i < 8 * 8; i++) {
    rgb[i * 3] = red;
    rgb[i * 3 + 1] = green;
    rgb[i * 3 + 2] = blue;
  }
  return encodeRgbPng(8, 8, rgb);
}

function responseFor(body: Buffer, status = 200, extra: Record<string, string> = {}): Response {
  return new Response(new Uint8Array(body), { status, headers: { "content-type": "image/png", ...extra } });
}

async function main() {
  const red = png(250, 250, 250);
  const redAgain = png(250, 250, 250);
  const blue = png(0, 0, 0);
  const sameUrl = await captureAssets(["https://cdn.example/a.png"], {
    fetchImpl: async () => responseFor(red),
  });
  const replaced = await captureAssets(["https://cdn.example/a.png"], {
    fetchImpl: async () => responseFor(blue),
  });
  const moved = await captureAssets(["https://cdn.example/b.png"], {
    fetchImpl: async () => responseFor(redAgain),
  });
  const replacedDiff = compareAssets(sameUrl, replaced);
  const movedDiff = compareAssets(sameUrl, moved);
  record(
    "same URL with different image bytes",
    replacedDiff.changed && replacedDiff.evidence[0]?.type === "image_replaced",
    replacedDiff.evidence[0]?.type ?? "none"
  );
  record(
    "different URL with identical bytes",
    movedDiff.evidence.some((item) => item.type === "image_relocated"),
    movedDiff.evidence.map((item) => item.type).join(",")
  );
  const distance = hamming(sameUrl[0]?.phash ?? null, replaced[0]?.phash ?? null);
  const similar = hamming(averageHash({ width: 2, height: 2, gray: Uint8Array.from([200, 205, 210, 215]) }), averageHash({ width: 2, height: 2, gray: Uint8Array.from([202, 206, 211, 216]) }));
  record("perceptual hash separates solid colors and keeps near shades close", distance != null && distance > 8 && similar != null && similar <= 8, `far=${distance} near=${similar}`);

  const pdfA = await captureAssets(["https://cdn.example/doc.pdf"], {
    fetchImpl: async () => new Response(new Uint8Array(Buffer.from("pdf-version-1")), { headers: { "content-type": "application/pdf" } }),
  });
  const pdfB = await captureAssets(["https://cdn.example/doc.pdf"], {
    fetchImpl: async () => new Response(new Uint8Array(Buffer.from("pdf-version-2-longer")), { headers: { "content-type": "application/pdf" } }),
  });
  const pdfDiff = compareAssets(pdfA, pdfB);
  record(
    "PDF replaced at the same URL",
    pdfDiff.evidence[0]?.type === "file_replaced" && pdfA[0]?.bytes !== pdfB[0]?.bytes,
    `${pdfA[0]?.bytes} -> ${pdfB[0]?.bytes}`
  );

  const tooBig = await captureAssets(["https://cdn.example/huge.png"], {
    fetchImpl: async () => responseFor(Buffer.from("x"), 200, { "content-length": String(MAX_IMAGE_BYTES + 1) }),
  });
  record("large file is not treated as unchanged", tooBig[0]?.status === "too_large" && compareAssets(sameUrl, tooBig).incomplete, tooBig[0]?.detail ?? "");

  const timedOut = await captureAssets(["https://cdn.example/slow.png"], {
    fetchImpl: async () => {
      throw new Error("The operation was aborted due to timeout");
    },
  });
  record("download timeout is a failure", timedOut[0]?.status === "timeout", timedOut[0]?.status ?? "");

  const failed = await captureAssets(["https://cdn.example/missing.png"], {
    fetchImpl: async () => new Response("no", { status: 404 }),
  });
  record("failed download is incomplete", compareAssets(sameUrl, failed).incomplete, failed[0]?.detail ?? "");

  record("javascript shell with an empty root needs a browser", httpResponseNeedsBrowser('<div id="root"></div><script src="/app.js"></script>', ""), "shell");
  record("page with real text does not need a browser", httpResponseNeedsBrowser("<p>" + "Visible article text. ".repeat(40) + "</p><script></script>", "Visible article text. ".repeat(40)) === false, "text");
  record(
    "empty article shell needs a browser",
    httpResponseNeedsBrowser("<article></article><script></script><script></script>", ""),
    "article"
  );

  const grid = Array.from({ length: 48 * 48 }, () => 10);
  const changed = grid.slice();
  for (let i = 0; i < 16 * 16; i++) changed[i] = 220;
  const regions = compareVisualRegions(grid, changed);
  const ignored = compareVisualRegions(grid, changed, ["top"]);
  record("visual region names the top of the screenshot", regions.changed && regions.regions.some((region) => region.name.startsWith("top")), regions.regions.map((region) => region.name).join(","));
  record("ignored top region suppresses that band", ignored.regions.every((region) => !region.name.startsWith("top")), ignored.regions.map((region) => region.name).join(",") || "none");

  const probe = probeSelector('<div id="price">$10</div><a class="buy" href="/cart">Buy</a><img alt="hero" src="/a.jpg">', "#price, .buy, img");
  record("multiple simple selectors", probe.matched >= 2 && probe.failed.length === 0, probe.note);
  const missing = probeSelector("<p>Hello</p>", "#price, .missing");
  record("missing selectors are reported and not called a deletion", missing.matched === 0 && missing.note.includes("not proof"), missing.note);
  const attr = probeSelector('<a href="/next">Next</a>', 'a');
  record("element text sample", attr.matched === 1 && attr.sample?.includes("Next") === true, attr.sample ?? "");

  const unchanged = compareSnapshots({
    monitorId: "dedupe",
    mode: MonitoringMode.ENTIRE_PAGE,
    previousHash: "same",
    previousText: "same",
    previousMetadata: { assets: sameUrl },
    current: { rawHtml: "<p>same</p>", cleanedHtml: "<p>same</p>", extractedText: "same", contentHash: "same", metadata: { assets: sameUrl } },
  });
  const contentChange = compareSnapshots({
    monitorId: "dedupe",
    mode: MonitoringMode.ENTIRE_PAGE,
    previousHash: "same",
    previousText: "same",
    previousMetadata: { assets: sameUrl },
    current: { rawHtml: "<p>same</p>", cleanedHtml: "<p>same</p>", extractedText: "same", contentHash: "same", metadata: { assets: replaced } },
  });
  record("identical content does not notify again", unchanged.changed === false, unchanged.reason);
  record(
    "content hash change is explained without treating the page text as the cause",
    contentChange.changed === true && (contentChange.summaryLines ?? []).some((line) => line.startsWith("Image replaced")),
    (contentChange.summaryLines ?? []).join("; ")
  );

  const passed = results.filter((item) => item.ok).length;
  console.log(`\n${passed}/${results.length} asset and detection checks passed on fixtures. No live site was called.`);
  if (results.some((item) => !item.ok)) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
