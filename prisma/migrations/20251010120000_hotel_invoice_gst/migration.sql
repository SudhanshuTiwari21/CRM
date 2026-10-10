-- AlterTable
ALTER TABLE "HotelBooking" ADD COLUMN "baseFare" DECIMAL(12,2);
ALTER TABLE "HotelBooking" ADD COLUMN "serviceCharge" DECIMAL(12,2);
ALTER TABLE "HotelBooking" ADD COLUMN "discountAmount" DECIMAL(12,2);
ALTER TABLE "HotelBooking" ADD COLUMN "invoiceTaxType" "InvoiceTaxType" NOT NULL DEFAULT 'NON_ITC';
ALTER TABLE "HotelBooking" ADD COLUMN "buyerGstin" TEXT;
ALTER TABLE "HotelBooking" ADD COLUMN "buyerState" TEXT;
ALTER TABLE "HotelBooking" ADD COLUMN "buyerStateCode" TEXT;
ALTER TABLE "HotelBooking" ADD COLUMN "placeOfSupply" TEXT;
ALTER TABLE "HotelBooking" ADD COLUMN "invoiceNarration" TEXT;
ALTER TABLE "HotelBooking" ADD COLUMN "msmeNumber" TEXT;
ALTER TABLE "HotelBooking" ADD COLUMN "hsnSac" TEXT NOT NULL DEFAULT '998552';
ALTER TABLE "HotelBooking" ADD COLUMN "cgstRate" DECIMAL(5,2);
ALTER TABLE "HotelBooking" ADD COLUMN "sgstRate" DECIMAL(5,2);
ALTER TABLE "HotelBooking" ADD COLUMN "igstRate" DECIMAL(5,2);
ALTER TABLE "HotelBooking" ADD COLUMN "cgstAmount" DECIMAL(12,2);
ALTER TABLE "HotelBooking" ADD COLUMN "sgstAmount" DECIMAL(12,2);
ALTER TABLE "HotelBooking" ADD COLUMN "igstAmount" DECIMAL(12,2);
