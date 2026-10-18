-- CreateTable
CREATE TABLE "Activity" (
    "id" TEXT NOT NULL,
    "brandId" "CrmBrand" NOT NULL DEFAULT 'BOOK_TO_ROAM',
    "city" TEXT NOT NULL,
    "country" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "tag" TEXT,
    "startTimes" TEXT,
    "duration" TEXT,
    "costPrice" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "sellPrice" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Activity_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Activity_brandId_idx" ON "Activity"("brandId");

-- CreateIndex
CREATE INDEX "Activity_brandId_city_idx" ON "Activity"("brandId", "city");

-- CreateIndex
CREATE INDEX "Activity_name_idx" ON "Activity"("name");

-- AlterTable
ALTER TABLE "TripPlan" ADD COLUMN "leavingFrom" TEXT;
ALTER TABLE "TripPlan" ADD COLUMN "nationality" TEXT;
ALTER TABLE "TripPlan" ADD COLUMN "roomCount" INTEGER;
ALTER TABLE "TripPlan" ADD COLUMN "itineraryJson" JSONB;
