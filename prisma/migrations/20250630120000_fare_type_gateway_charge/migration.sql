-- CreateEnum
CREATE TYPE "FareType" AS ENUM ('NORMAL', 'CORP', 'FLEXI', 'UPFRONT');

-- AlterTable
ALTER TABLE "FlightBooking" ADD COLUMN "fareType" "FareType" NOT NULL DEFAULT 'NORMAL',
ADD COLUMN "paymentGatewayCharge" DECIMAL(12,2);
