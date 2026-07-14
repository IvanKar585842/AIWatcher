-- AlterTable
ALTER TABLE "User" ADD COLUMN "productTourCompleted" BOOLEAN NOT NULL DEFAULT false;

-- Existing onboarded users should not be interrupted by the new tour
UPDATE "User" SET "productTourCompleted" = true WHERE "onboardingCompleted" = true;
