-- CreateTable
CREATE TABLE "InboxReadReceipt" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "messageKey" TEXT NOT NULL,
    "readAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InboxReadReceipt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "InboxReadReceipt_userId_idx" ON "InboxReadReceipt"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "InboxReadReceipt_userId_messageKey_key" ON "InboxReadReceipt"("userId", "messageKey");

-- AddForeignKey
ALTER TABLE "InboxReadReceipt" ADD CONSTRAINT "InboxReadReceipt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
