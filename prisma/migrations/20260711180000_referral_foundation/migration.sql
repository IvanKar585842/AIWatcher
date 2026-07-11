-- Referral foundation (no payments / rewards yet)
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "referralCode" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "referredBy" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "referralSignups" INTEGER NOT NULL DEFAULT 0;

CREATE UNIQUE INDEX IF NOT EXISTS "User_referralCode_key" ON "User"("referralCode");
CREATE INDEX IF NOT EXISTS "User_referralCode_idx" ON "User"("referralCode");
