-- Lookup Telegram-linked users by chat id during /start webhook handling
CREATE INDEX IF NOT EXISTS "User_telegramChatId_idx" ON "User"("telegramChatId");
