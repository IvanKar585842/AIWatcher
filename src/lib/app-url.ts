/**
 * Canonical public app origin for redirects (Stripe, emails, Telegram).
 * Never send users to the old Vercel alias (ai-watcher.vercel.app).
 */
export const CANONICAL_APP_URL = "https://watchflowing.com";

export function getAppBaseUrl(): string {
  const raw =
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim() ||
    "";

  if (!raw) {
    return process.env.NODE_ENV === "production"
      ? CANONICAL_APP_URL
      : "http://localhost:3000";
  }

  const withProtocol = raw.startsWith("http") ? raw : `https://${raw}`;
  let origin: string;
  try {
    origin = new URL(withProtocol).origin;
  } catch {
    return CANONICAL_APP_URL;
  }

  const host = new URL(origin).hostname.toLowerCase();

  // Local development
  if (host === "localhost" || host === "127.0.0.1") {
    return origin;
  }

  // Production brand domain (with or without www)
  if (host === "watchflowing.com" || host === "www.watchflowing.com") {
    return CANONICAL_APP_URL;
  }

  // Legacy Vercel preview/alias — always redirect to the real domain
  if (host.endsWith(".vercel.app") || host.includes("ai-watcher")) {
    return CANONICAL_APP_URL;
  }

  return origin.replace(/\/$/, "");
}
