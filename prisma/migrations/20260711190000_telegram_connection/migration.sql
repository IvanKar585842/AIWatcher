-- AlterTable
ALTER TABLE "User" ADD COLUMN "telegramConnected" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN "telegramConnectedAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN "telegramNotificationsEnabled" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "User" ADD COLUMN "emailNotificationsEnabled" BOOLEAN NOT NULL DEFAULT true;

-- Backfill existing linked Telegram users without breaking accounts
UPDATE "User"
SET
  "telegramConnected" = true,
  "telegramConnectedAt" = COALESCE("updatedAt", CURRENT_TIMESTAMP)
WHERE "telegramChatId" IS NOT NULL;
