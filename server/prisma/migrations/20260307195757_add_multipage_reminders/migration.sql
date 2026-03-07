-- AlterTable
ALTER TABLE "Mail" ADD COLUMN     "imageUrls" JSONB,
ADD COLUMN     "reminderAt" TIMESTAMP(3),
ADD COLUMN     "reminderSent" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "Mail_reminderAt_reminderSent_idx" ON "Mail"("reminderAt", "reminderSent");
