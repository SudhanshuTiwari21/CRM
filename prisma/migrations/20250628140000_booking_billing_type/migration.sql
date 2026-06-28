-- CreateEnum
CREATE TYPE "BillingType" AS ENUM ('CASH', 'LEDGER');

-- AlterTable
ALTER TABLE "Booking" ADD COLUMN "billingType" "BillingType" NOT NULL DEFAULT 'LEDGER';

-- CreateIndex
CREATE INDEX "Booking_billingType_idx" ON "Booking"("billingType");
