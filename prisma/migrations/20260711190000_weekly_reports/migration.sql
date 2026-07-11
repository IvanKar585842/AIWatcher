-- Weekly AI Business Reports
DO $$ BEGIN
  CREATE TYPE "ReportFrequency" AS ENUM ('WEEKLY', 'MONTHLY');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "ReportType" AS ENUM ('BUSINESS', 'DEVELOPER', 'SEO', 'COMPETITOR');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "weeklyReportEnabled" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "reportFrequency" "ReportFrequency" NOT NULL DEFAULT 'WEEKLY';
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "reportType" "ReportType" NOT NULL DEFAULT 'BUSINESS';

CREATE TABLE IF NOT EXISTS "WeeklyReport" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "periodStart" TIMESTAMP(3) NOT NULL,
  "periodEnd" TIMESTAMP(3) NOT NULL,
  "reportType" "ReportType" NOT NULL DEFAULT 'BUSINESS',
  "frequency" "ReportFrequency" NOT NULL DEFAULT 'WEEKLY',
  "status" TEXT NOT NULL DEFAULT 'READY',
  "executiveSummary" TEXT NOT NULL,
  "payload" JSONB NOT NULL,
  "shareToken" TEXT,
  "shareEnabled" BOOLEAN NOT NULL DEFAULT false,
  "aiUsed" BOOLEAN NOT NULL DEFAULT false,
  "emailSentAt" TIMESTAMP(3),
  "telegramSentAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WeeklyReport_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "WeeklyReport_shareToken_key" ON "WeeklyReport"("shareToken");
CREATE UNIQUE INDEX IF NOT EXISTS "WeeklyReport_userId_periodStart_periodEnd_reportType_key"
  ON "WeeklyReport"("userId", "periodStart", "periodEnd", "reportType");
CREATE INDEX IF NOT EXISTS "WeeklyReport_userId_createdAt_idx" ON "WeeklyReport"("userId", "createdAt");
CREATE INDEX IF NOT EXISTS "WeeklyReport_shareToken_idx" ON "WeeklyReport"("shareToken");
CREATE INDEX IF NOT EXISTS "WeeklyReport_periodEnd_idx" ON "WeeklyReport"("periodEnd");

DO $$ BEGIN
  ALTER TABLE "WeeklyReport" ADD CONSTRAINT "WeeklyReport_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
