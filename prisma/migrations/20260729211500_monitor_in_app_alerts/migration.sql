CREATE TYPE "MonitorAlertKind" AS ENUM ('CHECK_FAILED', 'MONITOR_ERROR');

CREATE TABLE "MonitorAlert" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "monitorId" TEXT NOT NULL,
    "kind" "MonitorAlertKind" NOT NULL,
    "title" TEXT NOT NULL,
    "explanation" TEXT NOT NULL,
    "possibleCause" TEXT NOT NULL,
    "suggestedAction" TEXT NOT NULL,
    "errorKind" TEXT NOT NULL,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MonitorAlert_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "MonitorAlert_userId_createdAt_idx" ON "MonitorAlert"("userId", "createdAt");
CREATE INDEX "MonitorAlert_monitorId_createdAt_idx" ON "MonitorAlert"("monitorId", "createdAt");
CREATE INDEX "MonitorAlert_monitorId_kind_createdAt_idx" ON "MonitorAlert"("monitorId", "kind", "createdAt");

ALTER TABLE "MonitorAlert" ADD CONSTRAINT "MonitorAlert_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MonitorAlert" ADD CONSTRAINT "MonitorAlert_monitorId_fkey"
  FOREIGN KEY ("monitorId") REFERENCES "Monitor"("id") ON DELETE CASCADE ON UPDATE CASCADE;
