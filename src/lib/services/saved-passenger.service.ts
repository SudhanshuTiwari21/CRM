import { prisma } from "@/lib/db";
import type { Prisma } from "@prisma/client";
import type { UpsertSavedPassengerInput } from "@/lib/validators/saved-passenger";

function toResponse(row: {
  id: string;
  title: string;
  firstName: string;
  lastName: string | null;
  gender: string;
  paxType: string;
  seat: string | null;
  meal: string | null;
  handBaggage: string | null;
  checkInBaggage: string | null;
  baggagePreset: string | null;
  cabinBaggagePreset: string | null;
  frequentFlyerAirline: string | null;
  frequentFlyerNumber: string | null;
  wheelchairAssistance: boolean;
  dateOfBirth: string | null;
  passportNumber: string | null;
  passportIssuingCountry: string | null;
  passportIssueDate: string | null;
  passportExpiryDate: string | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    ...row,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function listSavedPassengers(search?: string) {
  const where: Prisma.SavedPassengerWhereInput = search
    ? {
        OR: [
          { firstName: { contains: search, mode: "insensitive" } },
          { lastName: { contains: search, mode: "insensitive" } },
          { seat: { contains: search, mode: "insensitive" } },
          { frequentFlyerNumber: { contains: search, mode: "insensitive" } },
          { passportNumber: { contains: search, mode: "insensitive" } },
        ],
      }
    : {};

  const rows = await prisma.savedPassenger.findMany({
    where,
    orderBy: [{ updatedAt: "desc" }],
    take: 50,
  });

  return rows.map(toResponse);
}

export async function upsertSavedPassenger(input: UpsertSavedPassengerInput, createdById?: string) {
  const firstName = input.firstName.trim();
  const lastName = input.lastName?.trim() || null;

  const existing = await prisma.savedPassenger.findFirst({
    where: {
      firstName: { equals: firstName, mode: "insensitive" },
      lastName: lastName
        ? { equals: lastName, mode: "insensitive" }
        : { equals: null },
    },
  });

  const data = {
    title: input.title,
    firstName,
    lastName,
    gender: input.gender,
    paxType: input.paxType,
    seat: input.seat?.trim() || null,
    meal: input.meal || null,
    handBaggage: input.handBaggage?.trim() || null,
    checkInBaggage: input.checkInBaggage?.trim() || null,
    baggagePreset: input.baggagePreset?.trim() || null,
    cabinBaggagePreset: input.cabinBaggagePreset?.trim() || null,
    frequentFlyerAirline: input.frequentFlyerAirline?.trim() || null,
    frequentFlyerNumber: input.frequentFlyerNumber?.trim() || null,
    wheelchairAssistance: input.wheelchairAssistance ?? false,
    dateOfBirth: input.dateOfBirth?.trim() || null,
    passportNumber: input.passportNumber?.trim() || null,
    passportIssuingCountry: input.passportIssuingCountry?.trim() || null,
    passportIssueDate: input.passportIssueDate?.trim() || null,
    passportExpiryDate: input.passportExpiryDate?.trim() || null,
  };

  if (existing) {
    const updated = await prisma.savedPassenger.update({
      where: { id: existing.id },
      data,
    });
    return { passenger: toResponse(updated), updated: true };
  }

  const created = await prisma.savedPassenger.create({
    data: {
      ...data,
      createdById,
    },
  });

  return { passenger: toResponse(created), updated: false };
}

export async function deleteSavedPassenger(id: string) {
  await prisma.savedPassenger.delete({ where: { id } });
}
