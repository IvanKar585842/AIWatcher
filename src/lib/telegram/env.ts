/**
 * Telegram environment accessors.
 * Canonical names match .env.example / README.
 * Legacy aliases accepted so a mistyped Vercel key still works.
 */

function firstEnv(...keys: string[]): string {
  for (const key of keys) {
    const value = process.env[key]?.trim();
    if (value) return value;
  }
  return "";
}

/** BotFather token — required to send messages / receive updates. */
export function getTelegramBotToken(): string {
  return firstEnv("TELEGRAM_BOT_TOKEN", "TELEGRAM_TOKEN", "TG_BOT_TOKEN");
}

/**
 * secret_token for setWebhook + x-telegram-bot-api-secret-token header.
 * Canonical: TELEGRAM_WEBHOOK_SECRET
 */
export function getTelegramWebhookSecret(): string {
  return firstEnv(
    "TELEGRAM_WEBHOOK_SECRET",
    "TELEGRAM_SECRET_TOKEN",
    "TELEGRAM_WEBHOOK_TOKEN",
    "TELEGRAM_SECRET"
  );
}

/** Public @username without @ — used for t.me connect links. */
export function getTelegramBotUsername(): string {
  return firstEnv("TELEGRAM_BOT_USERNAME", "TELEGRAM_USERNAME", "TG_BOT_USERNAME").replace(
    /^@/,
    ""
  );
}

/** Optional HMAC secret for link codes; falls back to webhook / cron secret. */
export function getTelegramLinkSecret(): string {
  return firstEnv(
    "TELEGRAM_LINK_SECRET",
    "TELEGRAM_WEBHOOK_SECRET",
    "TELEGRAM_SECRET_TOKEN",
    "TELEGRAM_SECRET",
    "CRON_SECRET"
  );
}
