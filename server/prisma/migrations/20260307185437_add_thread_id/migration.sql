-- AlterTable
ALTER TABLE "Mail" ADD COLUMN     "threadId" TEXT;

-- CreateIndex
CREATE INDEX "Mail_userId_threadId_idx" ON "Mail"("userId", "threadId");
