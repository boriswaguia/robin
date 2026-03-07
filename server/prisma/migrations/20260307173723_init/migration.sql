-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Mail" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "extractedText" TEXT,
    "summary" TEXT,
    "sender" TEXT,
    "category" TEXT,
    "urgency" TEXT,
    "dueDate" TEXT,
    "amountDue" TEXT,
    "suggestedActions" JSONB,
    "keyDetails" JSONB,
    "status" TEXT NOT NULL DEFAULT 'new',
    "actionTaken" TEXT,
    "actionNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Mail_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "Mail_userId_idx" ON "Mail"("userId");

-- CreateIndex
CREATE INDEX "Mail_userId_status_idx" ON "Mail"("userId", "status");

-- CreateIndex
CREATE INDEX "Mail_userId_category_idx" ON "Mail"("userId", "category");

-- AddForeignKey
ALTER TABLE "Mail" ADD CONSTRAINT "Mail_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
