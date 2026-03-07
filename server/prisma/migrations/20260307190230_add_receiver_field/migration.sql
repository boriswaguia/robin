-- AlterTable
ALTER TABLE "Mail" ADD COLUMN     "receiver" TEXT;

-- CreateIndex
CREATE INDEX "Mail_userId_sender_idx" ON "Mail"("userId", "sender");

-- CreateIndex
CREATE INDEX "Mail_userId_receiver_idx" ON "Mail"("userId", "receiver");
