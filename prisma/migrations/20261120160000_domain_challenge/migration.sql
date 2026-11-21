-- Longer-lived domain proof: an expiring challenge and a unique verification file.
-- Additive only. Existing rows keep working with a null file path and no expiry.

ALTER TABLE "DomainVerification" ADD COLUMN IF NOT EXISTS "expiresAt" TIMESTAMP(3);
ALTER TABLE "DomainVerification" ADD COLUMN IF NOT EXISTS "filePath" TEXT;
