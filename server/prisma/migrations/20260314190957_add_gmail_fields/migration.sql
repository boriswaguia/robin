-- AlterTable
ALTER TABLE "Mail" ADD COLUMN     "gmailMessageId" TEXT,
ADD COLUMN     "source" TEXT NOT NULL DEFAULT 'scan';

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "gmailAccessToken" TEXT,
ADD COLUMN     "gmailEmail" TEXT,
ADD COLUMN     "gmailRefreshToken" TEXT;

-- CreateIndex
CREATE INDEX "Mail_userId_gmailMessageId_idx" ON "Mail"("userId", "gmailMessageId");
