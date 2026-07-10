-- Advance payments: Payment can exist without a booking (customer wallet / advance receipt)
ALTER TABLE "Payment" ALTER COLUMN "bookingId" DROP NOT NULL;
ALTER TABLE "Payment" ADD COLUMN "customerId" TEXT;
CREATE INDEX "Payment_customerId_idx" ON "Payment"("customerId");
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
