-- AlterTable
ALTER TABLE "User" ADD COLUMN "username" TEXT;
ALTER TABLE "User" ADD COLUMN "statusPageEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN "statusPageTitle" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");
CREATE INDEX "User_username_idx" ON "User"("username");

-- AlterTable
ALTER TABLE "Monitor" ADD COLUMN "statusPageVisible" BOOLEAN NOT NULL DEFAULT true;
