import {
  getTelegramBotInfo,
  getTelegramWebhookInfo,
  setTelegramWebhook,
} from "@/lib/notifications/telegram";
import {
  getTelegramConfigStatus,
  getTelegramWebhookUrl,
  telegramLog,
  type TelegramUserFacingError,
} from "@/lib/telegram/config";

interface ProbeCache {
  at: number;
  ok: boolean;
  username: string | null;
  error: TelegramUserFacingError;
}

let probeCache: ProbeCache | null = null;
const PROBE_TTL_MS = 60_000;

/** Live probe of TELEGRAM_BOT_TOKEN via getMe (cached). */
export async function probeTelegramBot(): Promise<{
  ok: boolean;
  username: string | null;
  error: TelegramUserFacingError;
}> {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  if (!token) {
    return { ok: false, username: null, error: "Telegram bot is not configured" };
  }

  if (probeCache && Date.now() - probeCache.at < PROBE_TTL_MS) {
    return {
      ok: probeCache.ok,
      username: probeCache.username,
      error: probeCache.error,
    };
  }

  const result = await getTelegramBotInfo();
  if (!result.ok) {
    telegramLog("bot_probe_failed", { error: result.error });
    probeCache = {
      at: Date.now(),
      ok: false,
      username: null,
      error: "Invalid bot configuration",
    };
    return {
      ok: false,
      username: null,
      error: "Invalid bot configuration",
    };
  }

  const data = result.data as { result?: { username?: string } };
  const username = data?.result?.username ?? null;
  probeCache = { at: Date.now(), ok: true, username, error: null };
  return { ok: true, username, error: null };
}

let lastEnsureAt = 0;
const ENSURE_TTL_MS = 5 * 60_000;

/**
 * Register / refresh Telegram webhook to /api/telegram/webhook with secret.
 * Safe to call often — throttled when already pointing at us.
 */
export async function ensureTelegramWebhook(force = false): Promise<{
  ok: boolean;
  url: string | null;
  error: TelegramUserFacingError | string | null;
  pendingUpdates?: number;
  lastErrorMessage?: string | null;
}> {
  const config = getTelegramConfigStatus();
  if (!config.botConfigured) {
    return { ok: false, url: null, error: "Telegram bot is not configured" };
  }
  if (!config.webhookConfigured) {
    return { ok: false, url: null, error: "Telegram webhook is not configured" };
  }

  const webhookUrl = getTelegramWebhookUrl();
  if (!webhookUrl) {
    return { ok: false, url: null, error: "Webhook URL is not public" };
  }

  if (!force && Date.now() - lastEnsureAt < ENSURE_TTL_MS) {
    const info = await getTelegramWebhookInfo();
    if (info.ok) {
      const data = info.data as {
        result?: {
          url?: string;
          pending_update_count?: number;
          last_error_message?: string;
        };
      };
      const currentUrl = data.result?.url ?? "";
      if (currentUrl === webhookUrl) {
        return {
          ok: true,
          url: webhookUrl,
          error: null,
          pendingUpdates: data.result?.pending_update_count,
          lastErrorMessage: data.result?.last_error_message ?? null,
        };
      }
    }
  }

  const secret = process.env.TELEGRAM_WEBHOOK_SECRET!.trim();
  const setResult = await setTelegramWebhook(webhookUrl, secret);
  lastEnsureAt = Date.now();

  if (!setResult.ok) {
    telegramLog("set_webhook_failed", { error: setResult.error, webhookUrl });
    const err = /unauthorized/i.test(setResult.error)
      ? "Invalid bot configuration"
      : setResult.error;
    return { ok: false, url: webhookUrl, error: err };
  }

  telegramLog("set_webhook_ok", { webhookUrl });
  probeCache = null;

  const info = await getTelegramWebhookInfo();
  const data = info.ok
    ? (info.data as {
        result?: {
          pending_update_count?: number;
          last_error_message?: string;
        };
      })
    : null;

  return {
    ok: true,
    url: webhookUrl,
    error: null,
    pendingUpdates: data?.result?.pending_update_count,
    lastErrorMessage: data?.result?.last_error_message ?? null,
  };
}
