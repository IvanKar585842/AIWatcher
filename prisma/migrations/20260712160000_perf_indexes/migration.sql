-- Performance indexes + AI analysis lease status
-- PROCESSING allows cluster-safe claim of pending AI analyses

ALTER TYPE "AnalysisStatus" ADD VALUE IF NOT EXISTS 'PROCESSING';

CREATE INDEX IF NOT EXISTS "Notification_userId_createdAt_idx" ON "Notification"("userId", "createdAt");
CREATE INDEX IF NOT EXISTS "MonitorQueue_scheduledAt_lockedAt_idx" ON "MonitorQueue"("scheduledAt", "lockedAt");
