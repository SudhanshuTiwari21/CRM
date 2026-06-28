-- CreateTable
CREATE TABLE "SavedPassenger" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL DEFAULT 'Mr',
    "firstName" TEXT NOT NULL,
    "lastName" TEXT,
    "gender" TEXT NOT NULL DEFAULT 'Male',
    "paxType" TEXT NOT NULL DEFAULT 'adult',
    "seat" TEXT,
    "meal" TEXT,
    "handBaggage" TEXT,
    "checkInBaggage" TEXT,
    "baggagePreset" TEXT,
    "cabinBaggagePreset" TEXT,
    "frequentFlyerAirline" TEXT,
    "frequentFlyerNumber" TEXT,
    "wheelchairAssistance" BOOLEAN NOT NULL DEFAULT false,
    "dateOfBirth" TEXT,
    "passportNumber" TEXT,
    "passportIssuingCountry" TEXT,
    "passportIssueDate" TEXT,
    "passportExpiryDate" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SavedPassenger_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SavedPassenger_firstName_idx" ON "SavedPassenger"("firstName");

-- CreateIndex
CREATE INDEX "SavedPassenger_lastName_idx" ON "SavedPassenger"("lastName");

-- CreateIndex
CREATE INDEX "SavedPassenger_createdAt_idx" ON "SavedPassenger"("createdAt");

-- AddForeignKey
ALTER TABLE "SavedPassenger" ADD CONSTRAINT "SavedPassenger_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
