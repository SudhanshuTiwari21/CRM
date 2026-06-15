-- CreateEnum
CREATE TYPE "InvoiceTaxType" AS ENUM ('ITC', 'NON_ITC');

-- AlterTable
ALTER TABLE "FlightBooking" ADD COLUMN "baseFare" DECIMAL(12,2);
ALTER TABLE "FlightBooking" ADD COLUMN "serviceCharge" DECIMAL(12,2);
ALTER TABLE "FlightBooking" ADD COLUMN "invoiceTaxType" "InvoiceTaxType" NOT NULL DEFAULT 'NON_ITC';
ALTER TABLE "FlightBooking" ADD COLUMN "buyerGstin" TEXT;
ALTER TABLE "FlightBooking" ADD COLUMN "buyerState" TEXT;
ALTER TABLE "FlightBooking" ADD COLUMN "buyerStateCode" TEXT;
ALTER TABLE "FlightBooking" ADD COLUMN "placeOfSupply" TEXT;
ALTER TABLE "FlightBooking" ADD COLUMN "hsnSac" TEXT NOT NULL DEFAULT '998551';
ALTER TABLE "FlightBooking" ADD COLUMN "cgstRate" DECIMAL(5,2);
ALTER TABLE "FlightBooking" ADD COLUMN "sgstRate" DECIMAL(5,2);
ALTER TABLE "FlightBooking" ADD COLUMN "igstRate" DECIMAL(5,2);
ALTER TABLE "FlightBooking" ADD COLUMN "cgstAmount" DECIMAL(12,2);
ALTER TABLE "FlightBooking" ADD COLUMN "sgstAmount" DECIMAL(12,2);
ALTER TABLE "FlightBooking" ADD COLUMN "igstAmount" DECIMAL(12,2);
