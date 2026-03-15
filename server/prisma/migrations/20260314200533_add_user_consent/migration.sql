-- AlterTable
ALTER TABLE "User" ADD COLUMN     "consentVersion" TEXT,
ADD COLUMN     "consentedAt" TIMESTAMP(3);
