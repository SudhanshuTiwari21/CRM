-- CreateEnum
CREATE TYPE "CancellationCategory" AS ENUM ('B2B', 'B2C');

-- CreateTable
CREATE TABLE "BookingCancellation" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "category" "CancellationCategory" NOT NULL,
    "reason" TEXT NOT NULL,
    "airlineRefund" DECIMAL(12,2),
    "supplierCharges" DECIMAL(12,2),
    "agencyCharges" DECIMAL(12,2),
    "customerRefund" DECIMAL(12,2),
    "cancellationFee" DECIMAL(12,2),
    "supplierPenalty" DECIMAL(12,2),
    "refundToCredit" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "cancelledById" TEXT,
    "cancelledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BookingCancellation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BookingCancellation_bookingId_key" ON "BookingCancellation"("bookingId");

-- CreateIndex
CREATE INDEX "BookingCancellation_category_idx" ON "BookingCancellation"("category");

-- CreateIndex
CREATE INDEX "BookingCancellation_cancelledAt_idx" ON "BookingCancellation"("cancelledAt");

-- AddForeignKey
ALTER TABLE "BookingCancellation" ADD CONSTRAINT "BookingCancellation_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingCancellation" ADD CONSTRAINT "BookingCancellation_cancelledById_fkey" FOREIGN KEY ("cancelledById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
