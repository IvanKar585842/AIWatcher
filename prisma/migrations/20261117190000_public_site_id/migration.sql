-- The value embedded in HTML is a public site id. The private server key stays hashed.

ALTER TABLE "SiteToken" ADD COLUMN IF NOT EXISTS "publicId" TEXT;

UPDATE "SiteToken"
SET "publicId" = 'wfsite_pub_' || substr(md5("id" || clock_timestamp()::text), 1, 22)
WHERE "publicId" IS NULL;

ALTER TABLE "SiteToken" ALTER COLUMN "publicId" SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "SiteToken_publicId_key" ON "SiteToken"("publicId");
