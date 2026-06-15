-- CreateEnum
CREATE TYPE "MealPlan" AS ENUM ('ROOM_ONLY', 'WITH_BREAKFAST', 'HALF_BOARD', 'FULL_BOARD');

-- CreateTable
CREATE TABLE "HotelProfile" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "city" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "checkInTime" TEXT NOT NULL DEFAULT '02:00 PM',
    "checkOutTime" TEXT NOT NULL DEFAULT '12:00 PM',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HotelProfile_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "HotelBooking" ADD COLUMN "hotelProfileId" TEXT,
ADD COLUMN "city" TEXT,
ADD COLUMN "propertyPhone" TEXT,
ADD COLUMN "propertyEmail" TEXT,
ADD COLUMN "checkInTime" TEXT NOT NULL DEFAULT '02:00 PM',
ADD COLUMN "checkOutTime" TEXT NOT NULL DEFAULT '12:00 PM',
ADD COLUMN "roomsCount" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN "mealPlan" "MealPlan" NOT NULL DEFAULT 'ROOM_ONLY',
ADD COLUMN "roomAmenities" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN "inclusions" TEXT,
ADD COLUMN "cancellationPolicy" TEXT,
ADD COLUMN "includeCancellationPolicy" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE UNIQUE INDEX "HotelProfile_name_key" ON "HotelProfile"("name");
CREATE INDEX "HotelProfile_name_idx" ON "HotelProfile"("name");

-- AddForeignKey
ALTER TABLE "HotelBooking" ADD CONSTRAINT "HotelBooking_hotelProfileId_fkey" FOREIGN KEY ("hotelProfileId") REFERENCES "HotelProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
