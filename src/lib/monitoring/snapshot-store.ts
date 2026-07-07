import { compressHtml, decompressHtml } from "./compress";

export async function prepareHtmlForStorage(html: string): Promise<string> {
  if (!html) return "";
  return compressHtml(html);
}

export async function readStoredHtml(stored: string | null | undefined): Promise<string> {
  if (!stored) return "";
  return decompressHtml(stored);
}

export async function readSnapshotHtml(snapshot: {
  cleanedHtml: string;
  extractedText?: string | null;
}): Promise<{ cleanedHtml: string; extractedText: string }> {
  const cleanedHtml = await readStoredHtml(snapshot.cleanedHtml);
  const extractedText = snapshot.extractedText ?? cleanedHtml.replace(/<[^>]+>/g, " ");
  return { cleanedHtml, extractedText };
}
