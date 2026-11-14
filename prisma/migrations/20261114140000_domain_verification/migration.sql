-- Proof that a monitor's owner controls its host. Does not change page fetching.

CREATE TABLE IF NOT EXISTS "DomainVerification" (
  "id" TEXT NOT NULL,
  "monitorId" TEXT NOT NULL,
  "token" TEXT NOT NULL,
  "verifiedAt" TIMESTAMP(3),
  "method" TEXT,
  "checkedAt" TIMESTAMP(3),
  "lastError" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DomainVerification_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "DomainVerification_monitorId_key" ON "DomainVerification"("monitorId");

DO $$ BEGIN
  ALTER TABLE "DomainVerification" ADD CONSTRAINT "DomainVerification_monitorId_fkey"
    FOREIGN KEY ("monitorId") REFERENCES "Monitor"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
