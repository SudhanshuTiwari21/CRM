-- CreateEnum
CREATE TYPE "CreditNoteSource" AS ENUM ('AUTO_CANCEL', 'MANUAL');

-- AlterTable Payment
ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "referenceNumber" TEXT;
ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "note" TEXT;
ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "billingType" "BillingType";
ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "createdById" TEXT;

-- CreateTable CreditNoteSerialCounter
CREATE TABLE IF NOT EXISTS "CreditNoteSerialCounter" (
    "year" INTEGER NOT NULL,
    "lastNumber" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "CreditNoteSerialCounter_pkey" PRIMARY KEY ("year")
);

-- CreateTable CreditNote
CREATE TABLE IF NOT EXISTS "CreditNote" (
    "id" TEXT NOT NULL,
    "publicRef" TEXT NOT NULL,
    "serialYear" INTEGER NOT NULL,
    "serialNumber" INTEGER NOT NULL,
    "customerId" TEXT NOT NULL,
    "bookingId" TEXT,
    "cancellationId" TEXT,
    "amount" DECIMAL(12,2) NOT NULL,
    "billingType" "BillingType",
    "reason" TEXT,
    "notes" TEXT,
    "source" "CreditNoteSource" NOT NULL DEFAULT 'MANUAL',
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CreditNote_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "CreditNote_publicRef_key" ON "CreditNote"("publicRef");
CREATE UNIQUE INDEX IF NOT EXISTS "CreditNote_cancellationId_key" ON "CreditNote"("cancellationId");
CREATE UNIQUE INDEX IF NOT EXISTS "CreditNote_serialYear_serialNumber_key" ON "CreditNote"("serialYear", "serialNumber");
CREATE INDEX IF NOT EXISTS "CreditNote_customerId_idx" ON "CreditNote"("customerId");
CREATE INDEX IF NOT EXISTS "CreditNote_bookingId_idx" ON "CreditNote"("bookingId");
CREATE INDEX IF NOT EXISTS "CreditNote_createdAt_idx" ON "CreditNote"("createdAt");

ALTER TABLE "Payment" ADD CONSTRAINT "Payment_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CreditNote" ADD CONSTRAINT "CreditNote_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CreditNote" ADD CONSTRAINT "CreditNote_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CreditNote" ADD CONSTRAINT "CreditNote_cancellationId_fkey" FOREIGN KEY ("cancellationId") REFERENCES "BookingCancellation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CreditNote" ADD CONSTRAINT "CreditNote_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "Payment_paidAt_idx" ON "Payment"("paidAt");
