-- Add-on services trip type (seat / meal / custom)
ALTER TYPE "TripType" ADD VALUE IF NOT EXISTS 'ADDON_SERVICES';

CREATE TYPE "AddonType" AS ENUM ('SEAT', 'FOOD', 'CUSTOM');

ALTER TABLE "FlightBooking" ADD COLUMN IF NOT EXISTS "addonType" "AddonType";
ALTER TABLE "FlightBooking" ADD COLUMN IF NOT EXISTS "addonCustomLabel" TEXT;
ALTER TABLE "FlightBooking" ADD COLUMN IF NOT EXISTS "addonCustomValue" TEXT;
