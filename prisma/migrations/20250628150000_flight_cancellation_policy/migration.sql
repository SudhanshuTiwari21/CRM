-- AlterTable
ALTER TABLE "FlightBooking" ADD COLUMN "cancellationPolicy" TEXT;
ALTER TABLE "FlightBooking" ADD COLUMN "includeCancellationPolicy" BOOLEAN NOT NULL DEFAULT false;
