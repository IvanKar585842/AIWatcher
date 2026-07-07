import { gzip, gunzip } from "node:zlib";
import { promisify } from "node:util";

const gzipAsync = promisify(gzip);
const gunzipAsync = promisify(gunzip);

const PREFIX = "gz:";

export async function compressHtml(html: string): Promise<string> {
  if (!html || html.startsWith(PREFIX)) return html;
  const compressed = await gzipAsync(Buffer.from(html, "utf-8"));
  return PREFIX + compressed.toString("base64");
}

export async function decompressHtml(stored: string): Promise<string> {
  if (!stored.startsWith(PREFIX)) return stored;
  const buf = Buffer.from(stored.slice(PREFIX.length), "base64");
  const decompressed = await gunzipAsync(buf);
  return decompressed.toString("utf-8");
}

export function isCompressed(stored: string): boolean {
  return stored.startsWith(PREFIX);
}
