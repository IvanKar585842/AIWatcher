-- Owner-installed site script. The key is stored as a hash. Signals do not store visitors.

CREATE TABLE IF NOT EXISTS "SiteToken" (
  "id" TEXT NOT NULL,
  "monitorId" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "prefix" TEXT NOT NULL,
  "revokedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SiteToken_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "SiteToken_monitorId_key" ON "SiteToken"("monitorId");
CREATE UNIQUE INDEX IF NOT EXISTS "SiteToken_tokenHash_key" ON "SiteToken"("tokenHash");

CREATE TABLE IF NOT EXISTS "SiteSignal" (
  "id" TEXT NOT NULL,
  "monitorId" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "selector" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SiteSignal_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "SiteSignal_monitorId_createdAt_idx" ON "SiteSignal"("monitorId", "createdAt");

DO $$ BEGIN
  ALTER TABLE "SiteToken" ADD CONSTRAINT "SiteToken_monitorId_fkey"
    FOREIGN KEY ("monitorId") REFERENCES "Monitor"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "SiteSignal" ADD CONSTRAINT "SiteSignal_monitorId_fkey"
    FOREIGN KEY ("monitorId") REFERENCES "Monitor"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
