import { prisma } from "@/lib/db";
import { getAirlineLogoUrl } from "@/lib/airline-logo";

export interface AirlineProfileInput {
  name: string;
  iataCode?: string;
  logoUrl?: string;
}

export async function upsertAirlineProfile(input: AirlineProfileInput) {
  const name = input.name.trim();
  if (!name) throw new Error("Airline name is required");

  const logoUrl = input.logoUrl || getAirlineLogoUrl(name) || undefined;

  return prisma.airlineProfile.upsert({
    where: { name },
    update: {
      iataCode: input.iataCode,
      logoUrl,
    },
    create: {
      name,
      iataCode: input.iataCode,
      logoUrl,
    },
  });
}

export async function findAirlineProfileByName(name: string) {
  return prisma.airlineProfile.findUnique({
    where: { name: name.trim() },
  });
}

export async function listAirlineProfiles(search?: string) {
  return prisma.airlineProfile.findMany({
    where: search
      ? { name: { contains: search, mode: "insensitive" } }
      : undefined,
    orderBy: { name: "asc" },
    take: 20,
  });
}
