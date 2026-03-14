/*
  Warnings:

  - A unique constraint covering the columns `[userId,gmailMessageId]` on the table `Mail` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "Mail_userId_gmailMessageId_idx";

-- AlterTable
ALTER TABLE "Mail" ALTER COLUMN "imageUrl" DROP NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Mail_userId_gmailMessageId_key" ON "Mail"("userId", "gmailMessageId");
