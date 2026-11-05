import { createHash } from "crypto";
import { deflateSync, inflateSync } from "zlib";

export const MAX_IMAGE_BYTES = 1_500_000;
export const MAX_FILE_BYTES = 4_000_000;
export const MAX_ASSETS_PER_CHECK = 6;

export type AssetStatus = "hashed" | "too_large" | "timeout" | "failed";

export interface AssetSnapshot {
  url: string;
  kind: "image" | "file";
  sha256: string | null;
  bytes: number | null;
  mime: string | null;
  width: number | null;
  height: number | null;
  /** 8x8 average hash as 16 hex chars. Null when the format cannot be decoded. */
  phash: string | null;
  status: AssetStatus;
  detail: string | null;
}

export interface AssetEvidence {
  type: "image_replaced" | "image_relocated" | "image_similar" | "file_replaced" | "asset_unverified";
  field: string;
  previous: string | null;
  current: string | null;
  url: string | null;
  confidence: "complete" | "partial";
}

const FILE_EXT = /\.(pdf|docx?|xlsx?|csv|zip|txt)(?:$|\?)/i;

export function sha256(buffer: Buffer): string {
  return createHash("sha256").update(buffer).digest("hex");
}

export function urlsForAssetCheck(
  profile: { images?: string[]; links?: string[] } | null | undefined,
  pageUrl: string,
  filesOnly: boolean
): string[] {
  const images = filesOnly ? [] : profile?.images ?? [];
  const files = (profile?.links ?? [])
    .map((link) => (link.includes(" -> ") ? link.split(" -> ").pop() ?? "" : link))
    .filter((url) => isFileUrl(url));
  const raw = filesOnly ? files : [...images.map((image) => image.split(" ")[0] ?? image), ...files];
  const absolute: string[] = [];
  for (const value of raw) {
    try {
      const url = new URL(value, pageUrl);
      if (url.protocol === "http:" || url.protocol === "https:") absolute.push(url.toString());
    } catch {
      continue;
    }
  }
  return [...new Set(absolute)].slice(0, MAX_ASSETS_PER_CHECK);
}

export function isFileUrl(url: string): boolean {
  return FILE_EXT.test(url);
}

export async function captureAssets(
  urls: string[],
  options: { fetchImpl?: typeof fetch; timeoutMs?: number; referer?: string } = {}
): Promise<AssetSnapshot[]> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const timeoutMs = options.timeoutMs ?? 8000;
  const selected = [...new Set(urls.map((url) => url.trim()).filter(Boolean))].slice(0, MAX_ASSETS_PER_CHECK);
  const results: AssetSnapshot[] = [];
  for (let i = 0; i < selected.length; i += 2) {
    const batch = selected.slice(i, i + 2);
    const done = await Promise.all(batch.map((url) => captureOne(url, fetchImpl, timeoutMs, options.referer)));
    results.push(...done);
  }
  return results;
}

async function captureOne(
  url: string,
  fetchImpl: typeof fetch,
  timeoutMs: number,
  referer?: string
): Promise<AssetSnapshot> {
  const kind = isFileUrl(url) ? "file" : "image";
  const limit = kind === "file" ? MAX_FILE_BYTES : MAX_IMAGE_BYTES;
  try {
    const response = await fetchImpl(url, {
      headers: {
        Accept: kind === "image" ? "image/*,*/*" : "*/*",
        "User-Agent": "WatchFlowing/1.0 (+https://watchflowing.com/bot; monitoring service)",
        ...(referer ? { Referer: referer } : {}),
      },
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!response.ok) {
      return empty(url, kind, "failed", `HTTP ${response.status}`);
    }
    const read = await readLimited(response, limit);
    if (read.status !== "ok" || !read.buffer) {
      return empty(url, kind, read.status === "too_large" ? "too_large" : "failed", read.detail);
    }
    const decoded = kind === "image" ? decodePng(read.buffer) : null;
    return {
      url,
      kind,
      sha256: sha256(read.buffer),
      bytes: read.buffer.length,
      mime: response.headers.get("content-type"),
      width: decoded?.width ?? null,
      height: decoded?.height ?? null,
      phash: decoded ? averageHash(decoded) : null,
      status: "hashed",
      detail: decoded ? null : kind === "image" ? "Perceptual hash is available for PNG only. Content hash was stored." : null,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const timeout = /timeout|aborted/i.test(message);
    return empty(url, kind, timeout ? "timeout" : "failed", message.slice(0, 160));
  }
}

export function compareAssets(previous: AssetSnapshot[] | null | undefined, current: AssetSnapshot[] | null | undefined): {
  changed: boolean;
  incomplete: boolean;
  evidence: AssetEvidence[];
} {
  if (!current?.length) return { changed: false, incomplete: false, evidence: [] };
  const evidence: AssetEvidence[] = [];
  let incomplete = false;
  const prevByUrl = new Map((previous ?? []).map((asset) => [asset.url, asset]));
  const prevByHash = new Map((previous ?? []).filter((asset) => asset.sha256).map((asset) => [asset.sha256 as string, asset]));

  for (const asset of current) {
    const prior = prevByUrl.get(asset.url);
    if (asset.status !== "hashed" || !asset.sha256) {
      incomplete = true;
      evidence.push({
        type: "asset_unverified",
        field: asset.kind,
        previous: prior?.sha256 ?? null,
        current: null,
        url: asset.url,
        confidence: "partial",
      });
      continue;
    }
    if (!prior) {
      const same = prevByHash.get(asset.sha256);
      if (same && same.url !== asset.url) {
        evidence.push({
          type: "image_relocated",
          field: asset.kind,
          previous: same.url,
          current: asset.url,
          url: asset.url,
          confidence: "complete",
        });
      }
      continue;
    }
    if (prior.sha256 && prior.sha256 !== asset.sha256) {
      const distance = hamming(prior.phash, asset.phash);
      evidence.push({
        type: asset.kind === "file" ? "file_replaced" : distance != null && distance <= 8 ? "image_similar" : "image_replaced",
        field: asset.kind,
        previous: prior.sha256.slice(0, 12),
        current: asset.sha256.slice(0, 12),
        url: asset.url,
        confidence: "complete",
      });
    }
  }
  const changed = evidence.some((item) => item.type !== "asset_unverified");
  return { changed, incomplete, evidence };
}

export function averageHash(image: { width: number; height: number; gray: Uint8Array }): string {
  const bits: number[] = [];
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) {
      const sx = Math.min(image.width - 1, Math.floor((x + 0.5) * image.width / 8));
      const sy = Math.min(image.height - 1, Math.floor((y + 0.5) * image.height / 8));
      bits.push(image.gray[sy * image.width + sx] >= 128 ? 1 : 0);
    }
  }
  let hex = "";
  for (let i = 0; i < 64; i += 4) {
    const nibble = (bits[i] << 3) | (bits[i + 1] << 2) | (bits[i + 2] << 1) | bits[i + 3];
    hex += nibble.toString(16);
  }
  return hex;
}

export function hamming(left: string | null, right: string | null): number | null {
  if (!left || !right || left.length !== right.length) return null;
  let distance = 0;
  for (let i = 0; i < left.length; i++) {
    let value = parseInt(left[i], 16) ^ parseInt(right[i], 16);
    while (value) {
      distance += value & 1;
      value >>= 1;
    }
  }
  return distance;
}

/** 8-bit RGB PNG, no interlacing. Used for perceptual hashes and tests. */
export function encodeRgbPng(width: number, height: number, rgb: Uint8Array): Buffer {
  const rowSize = 1 + width * 3;
  const raw = Buffer.alloc(rowSize * height);
  for (let y = 0; y < height; y++) {
    raw[y * rowSize] = 0;
    for (let x = 0; x < width; x++) {
      const src = (y * width + x) * 3;
      const dst = y * rowSize + 1 + x * 3;
      raw[dst] = rgb[src] ?? 0;
      raw[dst + 1] = rgb[src + 1] ?? 0;
      raw[dst + 2] = rgb[src + 2] ?? 0;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

export function decodePng(buffer: Buffer): { width: number; height: number; gray: Uint8Array } | null {
  if (buffer.length < 8 || buffer[0] !== 137 || buffer[1] !== 80) return null;
  let offset = 8;
  let width = 0;
  let height = 0;
  let colorType = 0;
  const idat: Buffer[] = [];
  while (offset + 8 <= buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.toString("ascii", offset + 4, offset + 8);
    const data = buffer.subarray(offset + 8, offset + 8 + length);
    offset += 12 + length;
    if (type === "IHDR") {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      if (data[8] !== 8 || data[9] !== 2 || data[12] !== 0) return null;
      colorType = data[9];
    } else if (type === "IDAT") {
      idat.push(Buffer.from(data));
    } else if (type === "IEND") break;
  }
  if (!width || !height || colorType !== 2 || width > 256 || height > 256) return null;
  let inflated: Buffer;
  try {
    inflated = inflateSync(Buffer.concat(idat));
  } catch {
    return null;
  }
  const channels = 3;
  const stride = width * channels;
  const gray = new Uint8Array(width * height);
  let previous = Buffer.alloc(stride);
  let cursor = 0;
  for (let y = 0; y < height; y++) {
    const filter = inflated[cursor];
    cursor += 1;
    const row = Buffer.from(inflated.subarray(cursor, cursor + stride));
    cursor += stride;
    for (let i = 0; i < stride; i++) {
      const left = i >= channels ? row[i - channels] : 0;
      const up = previous[i];
      const upLeft = i >= channels ? previous[i - channels] : 0;
      if (filter === 1) row[i] = (row[i] + left) & 255;
      else if (filter === 2) row[i] = (row[i] + up) & 255;
      else if (filter === 3) row[i] = (row[i] + Math.floor((left + up) / 2)) & 255;
      else if (filter === 4) row[i] = (row[i] + paeth(left, up, upLeft)) & 255;
    }
    for (let x = 0; x < width; x++) {
      const i = x * 3;
      gray[y * width + x] = Math.round(0.299 * row[i] + 0.587 * row[i + 1] + 0.114 * row[i + 2]);
    }
    previous = row;
  }
  return { width, height, gray };
}

function paeth(left: number, up: number, upLeft: number): number {
  const estimate = left + up - upLeft;
  const dl = Math.abs(estimate - left);
  const du = Math.abs(estimate - up);
  const dlu = Math.abs(estimate - upLeft);
  if (dl <= du && dl <= dlu) return left;
  if (du <= dlu) return up;
  return upLeft;
}

function chunk(type: string, data: Buffer): Buffer {
  const head = Buffer.alloc(8);
  head.writeUInt32BE(data.length, 0);
  head.write(type, 4, "ascii");
  const crc = crc32(Buffer.concat([Buffer.from(type), data]));
  const tail = Buffer.alloc(4);
  tail.writeUInt32BE(crc >>> 0, 0);
  return Buffer.concat([head, data, tail]);
}

function crc32(buffer: Buffer): number {
  let crc = ~0;
  for (const byte of buffer) {
    crc ^= byte;
    for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return ~crc >>> 0;
}

async function readLimited(response: Response, limit: number): Promise<{ status: "ok" | "too_large" | "failed"; buffer?: Buffer; detail: string | null }> {
  const declared = Number(response.headers.get("content-length") || "0");
  if (declared > limit) return { status: "too_large", detail: `Content-Length ${declared} exceeds ${limit}` };
  if (!response.body) {
    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.length > limit) return { status: "too_large", detail: `Body exceeds ${limit}` };
    return { status: "ok", buffer, detail: null };
  }
  const reader = response.body.getReader();
  const parts: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const step = await reader.read();
    if (step.done) break;
    total += step.value.byteLength;
    if (total > limit) {
      await reader.cancel();
      return { status: "too_large", detail: `Body exceeds ${limit}` };
    }
    parts.push(step.value);
  }
  return { status: "ok", buffer: Buffer.concat(parts.map((part) => Buffer.from(part))), detail: null };
}

function empty(url: string, kind: "image" | "file", status: AssetStatus, detail: string | null): AssetSnapshot {
  return { url, kind, sha256: null, bytes: null, mime: null, width: null, height: null, phash: null, status, detail };
}
