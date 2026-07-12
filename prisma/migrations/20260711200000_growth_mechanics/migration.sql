-- Growth mechanics: referral rewards, agency mode, badge, intelligence scores
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "referralBonusMonitors" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "referralProUntil" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "agencyModeEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "agencyBrandName" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "agencyShowPoweredBy" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "badgeEnabled" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS "IntelligenceScore" (
  "id" TEXT NOT NULL,
  "url" TEXT NOT NULL,
  "hostname" TEXT NOT NULL,
  "overallScore" INTEGER NOT NULL,
  "payload" JSONB NOT NULL,
  "userId" TEXT,
  "shareToken" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "IntelligenceScore_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "IntelligenceScore_shareToken_key" ON "IntelligenceScore"("shareToken");
CREATE INDEX IF NOT EXISTS "IntelligenceScore_hostname_createdAt_idx" ON "IntelligenceScore"("hostname", "createdAt");
CREATE INDEX IF NOT EXISTS "IntelligenceScore_userId_idx" ON "IntelligenceScore"("userId");
CREATE INDEX IF NOT EXISTS "IntelligenceScore_shareToken_idx" ON "IntelligenceScore"("shareToken");

DO $$ BEGIN
  ALTER TABLE "IntelligenceScore" ADD CONSTRAINT "IntelligenceScore_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
