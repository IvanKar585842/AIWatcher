import { loadEnv } from "./load-env";

loadEnv();

/**
 * Local Telegram receiver. Production uses the HTTPS webhook.
 * Polling calls deleteWebhook so Telegram delivers updates here.
 */
async function main() {
  const { getTelegramBotToken } = await import("../src/lib/telegram/env");
  if (!getTelegramBotToken()) {
    console.error(
      "TELEGRAM_BOT_TOKEN is missing. Create a bot in @BotFather and put the token in .env, then run npm run telegram:poll again."
    );
    process.exitCode = 1;
    return;
  }

  const { deleteTelegramWebhook, getTelegramUpdates } = await import(
    "../src/lib/notifications/telegram"
  );
  const { handleTelegramUpdate } = await import("../src/lib/telegram/bot");

  const cleared = await deleteTelegramWebhook();
  if (!cleared.ok) {
    console.error("Could not switch the bot from webhook to polling:", cleared.error);
    process.exitCode = 1;
    return;
  }

  console.log("Telegram polling started. Send /start to the bot.");
  let offset = 0;

  while (true) {
    const result = await getTelegramUpdates(offset, 20);
    if (!result.ok) {
      console.error("getUpdates failed:", result.error);
      await new Promise((resolve) => setTimeout(resolve, 3000));
      continue;
    }
    const data = result.data as {
      result?: Array<{ update_id: number; message?: { text?: string; chat: { id: number } } }>;
    };
    for (const update of data.result ?? []) {
      offset = update.update_id + 1;
      try {
        await handleTelegramUpdate(update);
      } catch (error) {
        console.error("update failed", update.update_id, error);
      }
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
