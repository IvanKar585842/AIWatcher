-- AlterTable
ALTER TABLE "ChatConversation" ADD COLUMN "summary" TEXT,
ADD COLUMN "summaryUpdatedAt" TIMESTAMP(3),
ADD COLUMN "totalTokens" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "totalCostUsd" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "ChatMessage" ADD COLUMN "promptTokens" INTEGER,
ADD COLUMN "completionTokens" INTEGER,
ADD COLUMN "totalTokens" INTEGER,
ADD COLUMN "costUsd" DOUBLE PRECISION,
ADD COLUMN "model" TEXT,
ADD COLUMN "cached" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "ChatMessage_createdAt_idx" ON "ChatMessage"("createdAt");
CREATE INDEX "ChatMessage_role_createdAt_idx" ON "ChatMessage"("role", "createdAt");

-- CreateTable
CREATE TABLE "ChatAnswerCache" (
    "id" TEXT NOT NULL,
    "normalizedQuestion" TEXT NOT NULL,
    "questionHash" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "hitCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChatAnswerCache_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ChatAnswerCache_normalizedQuestion_key" ON "ChatAnswerCache"("normalizedQuestion");
CREATE UNIQUE INDEX "ChatAnswerCache_questionHash_key" ON "ChatAnswerCache"("questionHash");
CREATE INDEX "ChatAnswerCache_hitCount_idx" ON "ChatAnswerCache"("hitCount");
