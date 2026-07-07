import { createHmac, timingSafeEqual } from "crypto";

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

export function createTelegramLinkCode(userId: string): string {
  const token = createHmac("sha256", getLinkSecret()).update(userId).digest("hex").slice(0, 24);
  return `link_${userId}_${token}`;
}

export function verifyTelegramLinkCode(linkCode: string): string | null {
  if (!linkCode.startsWith("link_")) return null;
  const parts = linkCode.split("_");
  if (parts.length < 3) return null;
  const userId = parts.slice(1, -1).join("_");
  const token = parts[parts.length - 1];
  if (!userId || !token) return null;

  const expected = createHmac("sha256", getLinkSecret()).update(userId).digest("hex").slice(0, 24);
  try {
    const a = Buffer.from(token);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  } catch {
    return null;
  }
  return userId;
}
