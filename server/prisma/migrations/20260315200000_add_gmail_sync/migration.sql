-- CreateTable
CREATE TABLE "GmailSync" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'in_progress',
    "scanned" INTEGER NOT NULL DEFAULT 0,
    "skipped" INTEGER NOT NULL DEFAULT 0,
    "found" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "GmailSync_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GmailSync_userId_idx" ON "GmailSync"("userId");

-- AddForeignKey
ALTER TABLE "GmailSync" ADD CONSTRAINT "GmailSync_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
