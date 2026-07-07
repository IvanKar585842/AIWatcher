-- Monitor queue table + change analysis status

CREATE TABLE IF NOT EXISTS "MonitorQueue" (
    "id" TEXT NOT NULL,
    "monitorId" TEXT NOT NULL,
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lockedAt" TIMESTAMP(3),
    "lockedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MonitorQueue_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "MonitorQueue_monitorId_key" ON "MonitorQueue"("monitorId");
CREATE INDEX IF NOT EXISTS "MonitorQueue_scheduledAt_idx" ON "MonitorQueue"("scheduledAt");
CREATE INDEX IF NOT EXISTS "MonitorQueue_lockedAt_idx" ON "MonitorQueue"("lockedAt");

DO $$ BEGIN
    CREATE TYPE "AnalysisStatus" AS ENUM ('PENDING', 'COMPLETED', 'SKIPPED', 'FAILED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

ALTER TABLE "Change" ADD COLUMN IF NOT EXISTS "analysisStatus" "AnalysisStatus" NOT NULL DEFAULT 'PENDING';
CREATE INDEX IF NOT EXISTS "Change_analysisStatus_idx" ON "Change"("analysisStatus");
