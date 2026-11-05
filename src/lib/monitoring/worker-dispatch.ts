/**
 * Vercel cron calls this URL instead of launching Chromium inside the function.
 * Only https, or http on localhost, is accepted.
 */
export function resolveWorkerRunUrl(raw: string | undefined): string | null {
  const value = raw?.trim();
  if (!value) return null;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  const host = url.hostname.replace(/^\[|\]$/g, "").toLowerCase();
  const local = host === "localhost" || host === "127.0.0.1" || host === "::1";
  if (url.protocol === "http:" && !local) return null;
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;
  if (url.pathname === "/" || url.pathname === "") url.pathname = "/run";
  url.search = "";
  url.hash = "";
  return url.toString();
}
