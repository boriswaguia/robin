-- CreateTable
CREATE TABLE "ShareConnection" (
    "id" TEXT NOT NULL,
    "fromUserId" TEXT NOT NULL,
    "toUserId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "sharedCategories" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShareConnection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MailShare" (
    "id" TEXT NOT NULL,
    "mailId" TEXT NOT NULL,
    "sharedByUserId" TEXT NOT NULL,
    "sharedWithUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MailShare_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ShareConnection_toUserId_idx" ON "ShareConnection"("toUserId");

-- CreateIndex
CREATE INDEX "ShareConnection_fromUserId_idx" ON "ShareConnection"("fromUserId");

-- CreateIndex
CREATE UNIQUE INDEX "ShareConnection_fromUserId_toUserId_key" ON "ShareConnection"("fromUserId", "toUserId");

-- CreateIndex
CREATE INDEX "MailShare_sharedWithUserId_idx" ON "MailShare"("sharedWithUserId");

-- CreateIndex
CREATE INDEX "MailShare_sharedByUserId_idx" ON "MailShare"("sharedByUserId");

-- CreateIndex
CREATE UNIQUE INDEX "MailShare_mailId_sharedWithUserId_key" ON "MailShare"("mailId", "sharedWithUserId");

-- AddForeignKey
ALTER TABLE "ShareConnection" ADD CONSTRAINT "ShareConnection_fromUserId_fkey" FOREIGN KEY ("fromUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShareConnection" ADD CONSTRAINT "ShareConnection_toUserId_fkey" FOREIGN KEY ("toUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MailShare" ADD CONSTRAINT "MailShare_mailId_fkey" FOREIGN KEY ("mailId") REFERENCES "Mail"("id") ON DELETE CASCADE ON UPDATE CASCADE;
