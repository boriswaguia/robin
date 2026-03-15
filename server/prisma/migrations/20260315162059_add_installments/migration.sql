-- AlterTable
ALTER TABLE "Mail" ADD COLUMN "parentId" TEXT,
ADD COLUMN "installmentLabel" TEXT;

-- CreateIndex
CREATE INDEX "Mail_parentId_idx" ON "Mail"("parentId");

-- AddForeignKey
ALTER TABLE "Mail" ADD CONSTRAINT "Mail_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Mail"("id") ON DELETE CASCADE ON UPDATE CASCADE;
