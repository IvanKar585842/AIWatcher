import { createHmac, timingSafeEqual } from "crypto";

const LINK_TTL_MS = 30 * 60 * 1000; // 30 minutes

function getLinkSecret(): string {
  const secret =
    process.env.TELEGRAM_LINK_SECRET ??
    process.env.TELEGRAM_WEBHOOK_SECRET ??
    process.env.CRON_SECRET;
  if (!secret) {
    throw new Error("Telegram link secret is not configured");
  }
  return secret;
}

function sign(payload: string): string {
  return createHmac("sha256", getLinkSecret()).update(payload).digest("hex").slice(0, 24);
}

function safeEqual(a: string, b: string): boolean {
  try {
    const bufA = Buffer.from(a);
    const bufB = Buffer.from(b);
    return bufA.length === bufB.length && timingSafeEqual(bufA, bufB);
  } catch {
    return false;
  }
}

export function createTelegramLinkCode(userId: string): string {
  const issuedAt = Date.now().toString(36);
  const token = sign(`${userId}:${issuedAt}`);
  return `link_${userId}_${issuedAt}_${token}`;
}

export function verifyTelegramLinkCode(linkCode: string): string | null {
  if (!linkCode.startsWith("link_")) return null;
  const parts = linkCode.split("_");
  if (parts.length < 4) return null;

  const token = parts[parts.length - 1];
  const issuedAt = parts[parts.length - 2];
  const userId = parts.slice(1, -2).join("_");
  if (!userId || !token || !issuedAt) return null;

  const issuedMs = parseInt(issuedAt, 36);
  if (!Number.isFinite(issuedMs) || Date.now() - issuedMs > LINK_TTL_MS) {
    return null;
  }

  const expected = sign(`${userId}:${issuedAt}`);
  if (!safeEqual(token, expected)) return null;

  return userId;
}
