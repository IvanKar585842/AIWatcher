/**
 * Telegram bot / webhook configuration flags (no network I/O).
 */

export type TelegramUserFacingError =
  | "Telegram bot is not configured"
  | "Invalid bot configuration"
  | "Telegram webhook is not configured"
  | "Webhook URL is not public"
  | "Telegram account is not connected"
  | "Unable to send Telegram notification"
  | null;

export interface TelegramConfigStatus {
  botConfigured: boolean;
  webhookConfigured: boolean;
  /** Public HTTPS app URL present (required for Telegram webhooks) */
  publicAppUrlConfigured: boolean;
  /** User-facing config problem, or null when OK */
  configError: TelegramUserFacingError;
}

export function getPublicAppUrl(): string | null {
  const raw =
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim() ||
    process.env.VERCEL_URL?.trim() ||
    "";
  if (!raw) return null;
  const withProtocol = raw.startsWith("http") ? raw : `https://${raw}`;
  try {
    const url = new URL(withProtocol);
    if (url.hostname === "localhost" || url.hostname === "127.0.0.1") {
      return null;
    }
    if (url.protocol !== "https:") {
      return null;
    }
    return url.origin.replace(/\/$/, "");
  } catch {
    return null;
  }
}

export function getTelegramWebhookUrl(): string | null {
  const origin = getPublicAppUrl();
  return origin ? `${origin}/api/telegram/webhook` : null;
}

export function getTelegramConfigStatus(): TelegramConfigStatus {
  const botConfigured = Boolean(process.env.TELEGRAM_BOT_TOKEN?.trim());
  const webhookConfigured = Boolean(process.env.TELEGRAM_WEBHOOK_SECRET?.trim());
  const publicAppUrlConfigured = Boolean(getPublicAppUrl());

  let configError: TelegramUserFacingError = null;
  if (!botConfigured) {
    configError = "Telegram bot is not configured";
  } else if (!webhookConfigured) {
    configError = "Telegram webhook is not configured";
  } else if (!publicAppUrlConfigured) {
    configError = "Webhook URL is not public";
  }

  return {
    botConfigured,
    webhookConfigured,
    publicAppUrlConfigured,
    configError,
  };
}

/** Map internal/Telegram API failures to safe user-facing copy */
export function toTelegramUserError(raw: string | null | undefined): string {
  const msg = (raw ?? "").toLowerCase();
  if (!msg || msg.includes("missing token") || msg.includes("not configured")) {
    return "Telegram bot is not configured";
  }
  if (msg.includes("unauthorized") || msg.includes("invalid bot")) {
    return "Invalid bot configuration";
  }
  if (msg.includes("webhook")) {
    return "Telegram webhook is not configured";
  }
  if (msg.includes("not connected") || msg.includes("user not connected")) {
    return "Telegram account is not connected";
  }
  return "Unable to send Telegram notification";
}

export function telegramLog(
  event: string,
  data?: Record<string, unknown>
): void {
  console.error(
    `[telegram][${event}]`,
    JSON.stringify({ ...data, timestamp: new Date().toISOString() })
  );
}
