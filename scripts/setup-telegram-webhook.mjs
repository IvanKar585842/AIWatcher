/**
 * One-shot production webhook registration for WatchFlowing Telegram bot.
 *
 * Usage (from repo root, with env loaded):
 *   node --env-file=.env.local scripts/setup-telegram-webhook.mjs
 *
 * Or with explicit env:
 *   TELEGRAM_BOT_TOKEN=... TELEGRAM_WEBHOOK_SECRET=... NEXT_PUBLIC_APP_URL=https://watchflowing.com \
 *     node scripts/setup-telegram-webhook.mjs
 */

const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
const secret = process.env.TELEGRAM_WEBHOOK_SECRET?.trim();
const appUrl = (process.env.NEXT_PUBLIC_APP_URL || "https://watchflowing.com")
  .trim()
  .replace(/\/$/, "");

if (!token) {
  console.error("Telegram bot is not configured (TELEGRAM_BOT_TOKEN missing)");
  process.exit(1);
}
if (!secret) {
  console.error("Telegram webhook is not configured (TELEGRAM_WEBHOOK_SECRET missing)");
  process.exit(1);
}
if (!appUrl.startsWith("https://") || appUrl.includes("localhost")) {
  console.error("NEXT_PUBLIC_APP_URL must be a public https:// URL (e.g. https://watchflowing.com)");
  process.exit(1);
}

const webhookUrl = `${appUrl}/api/telegram/webhook`;

async function main() {
  const meRes = await fetch(`https://api.telegram.org/bot${token}/getMe`);
  const me = await meRes.json();
  if (!me.ok) {
    console.error("Invalid bot configuration:", me.description || me);
    process.exit(1);
  }
  console.log("Bot OK:", me.result?.username);

  const setRes = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      url: webhookUrl,
      secret_token: secret,
      allowed_updates: ["message"],
    }),
  });
  const setJson = await setRes.json();
  if (!setJson.ok) {
    console.error("Unable to set webhook:", setJson.description || setJson);
    process.exit(1);
  }
  console.log("Webhook set:", webhookUrl);

  const infoRes = await fetch(`https://api.telegram.org/bot${token}/getWebhookInfo`);
  const info = await infoRes.json();
  console.log("Webhook info:", JSON.stringify(info.result, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
