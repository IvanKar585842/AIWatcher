-- Sync schema: monitor metadata columns, enum values, indexes, analytics tables

-- MonitoringMode enum extensions
ALTER TYPE "MonitoringMode" ADD VALUE IF NOT EXISTS 'VISUAL_CHANGES';
ALTER TYPE "MonitoringMode" ADD VALUE IF NOT EXISTS 'TEXT_CHANGES';
ALTER TYPE "MonitoringMode" ADD VALUE IF NOT EXISTS 'PRODUCT_AVAILABILITY';
ALTER TYPE "MonitoringMode" ADD VALUE IF NOT EXISTS 'DOCUMENTATION_CHANGES';
ALTER TYPE "MonitoringMode" ADD VALUE IF NOT EXISTS 'API_RESPONSE';
ALTER TYPE "MonitoringMode" ADD VALUE IF NOT EXISTS 'RSS_FEED';
ALTER TYPE "MonitoringMode" ADD VALUE IF NOT EXISTS 'HTML_DIFF';
ALTER TYPE "MonitoringMode" ADD VALUE IF NOT EXISTS 'SCREENSHOT_DIFF';

-- Monitor metadata columns
ALTER TABLE "Monitor" ADD COLUMN IF NOT EXISTS "description" TEXT;
ALTER TABLE "Monitor" ADD COLUMN IF NOT EXISTS "category" TEXT;
ALTER TABLE "Monitor" ADD COLUMN IF NOT EXISTS "tags" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "Monitor" ADD COLUMN IF NOT EXISTS "aiPrompt" TEXT;
ALTER TABLE "Monitor" ADD COLUMN IF NOT EXISTS "config" JSONB;

-- Analytics tables
CREATE TABLE IF NOT EXISTS "AnalyticsEvent" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "userId" TEXT,
    "metadata" JSONB,
    "durationMs" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AnalyticsEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ProcessedStripeEvent" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProcessedStripeEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "AnalyticsEvent_type_createdAt_idx" ON "AnalyticsEvent"("type", "createdAt");
CREATE INDEX IF NOT EXISTS "AnalyticsEvent_userId_idx" ON "AnalyticsEvent"("userId");
CREATE INDEX IF NOT EXISTS "Change_monitorId_createdAt_idx" ON "Change"("monitorId", "createdAt");
CREATE INDEX IF NOT EXISTS "Monitor_status_nextCheckAt_idx" ON "Monitor"("status", "nextCheckAt");
CREATE INDEX IF NOT EXISTS "Subscription_stripeSubscriptionId_idx" ON "Subscription"("stripeSubscriptionId");

-- Unique constraint (run after duplicate cleanup)
CREATE UNIQUE INDEX IF NOT EXISTS "Monitor_userId_url_key" ON "Monitor"("userId", "url");
