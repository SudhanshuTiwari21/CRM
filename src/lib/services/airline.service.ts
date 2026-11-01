import { prisma } from "@/lib/db";
import { COMMON_AIRLINES } from "@/lib/constants/flight";
import { getAirlineLogoUrl, resolveAirlineIata } from "@/lib/airline-logo";

export interface AirlineProfileInput {
  name: string;
  iataCode?: string;
  logoUrl?: string;
}

/** Prefer catalog spelling (e.g. SpiceJet) over SPICEJET / Spicejet. */
export function canonicalizeAirlineName(raw: string): string {
  const name = raw.trim().replace(/\s+/g, " ");
  if (!name) return "";

  const lower = name.toLowerCase();
  const byName = COMMON_AIRLINES.find((a) => a.name.toLowerCase() === lower);
  if (byName) return byName.name;

  const iata = resolveAirlineIata(name);
  if (iata) {
    const byIata = COMMON_AIRLINES.find((a) => a.iata === iata);
    if (byIata) return byIata.name;
  }

  // Title-case unknown airlines so "spice jet" → "Spice Jet"
  return name
    .split(" ")
    .map((part) => {
      if (/^[A-Z0-9]{2}$/i.test(part) && part.length === 2) return part.toUpperCase();
      return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
    })
    .join(" ");
}

async function findCaseInsensitiveProfiles(name: string) {
  const key = name.trim();
  if (!key) return [];
  return prisma.airlineProfile.findMany({
    where: { name: { equals: key, mode: "insensitive" } },
    orderBy: { updatedAt: "desc" },
  });
}

/** Collapse case variants into one row with canonical spelling. */
async function mergeDuplicateProfiles(
  canonicalName: string,
  extras?: { iataCode?: string; logoUrl?: string }
) {
  const matches = await findCaseInsensitiveProfiles(canonicalName);
  if (matches.length === 0) return null;

  const keeper =
    matches.find((p) => p.name === canonicalName) ||
    matches[0];

  const duplicateIds = matches.filter((p) => p.id !== keeper.id).map((p) => p.id);
  if (duplicateIds.length > 0) {
    await prisma.airlineProfile.deleteMany({ where: { id: { in: duplicateIds } } });
  }

  return prisma.airlineProfile.update({
    where: { id: keeper.id },
    data: {
      name: canonicalName,
      iataCode: extras?.iataCode ?? keeper.iataCode,
      logoUrl: extras?.logoUrl ?? keeper.logoUrl,
    },
  });
}

export async function upsertAirlineProfile(input: AirlineProfileInput) {
  const canonicalName = canonicalizeAirlineName(input.name);
  if (!canonicalName) throw new Error("Airline name is required");

  const iataCode = input.iataCode || resolveAirlineIata(canonicalName) || undefined;
  const logoUrl = input.logoUrl || getAirlineLogoUrl(canonicalName) || undefined;

  const merged = await mergeDuplicateProfiles(canonicalName, { iataCode, logoUrl });
  if (merged) return merged;

  try {
    return await prisma.airlineProfile.create({
      data: {
        name: canonicalName,
        iataCode,
        logoUrl,
      },
    });
  } catch (error) {
    // Race / exact unique collision — merge again
    const again = await mergeDuplicateProfiles(canonicalName, { iataCode, logoUrl });
    if (again) return again;
    throw error;
  }
}

export async function findAirlineProfileByName(name: string) {
  const canonicalName = canonicalizeAirlineName(name);
  if (!canonicalName) return null;

  const matches = await findCaseInsensitiveProfiles(canonicalName);
  if (matches.length === 0) return null;

  if (matches.length > 1 || matches[0].name !== canonicalName) {
    return mergeDuplicateProfiles(canonicalName);
  }

  return matches[0];
}

export async function listAirlineProfiles(search?: string, options?: { limit?: number }) {
  const limit = options?.limit ?? 20;
  const rows = await prisma.airlineProfile.findMany({
    where: search
      ? { name: { contains: search, mode: "insensitive" } }
      : undefined,
    orderBy: { name: "asc" },
    take: Math.max(limit * 2, 50),
  });

  // Dedupe case variants in the suggestion list (and heal DB as a side effect)
  const seen = new Map<string, (typeof rows)[number]>();
  const toMerge: string[] = [];

  for (const row of rows) {
    const key = row.name.trim().toLowerCase();
    const existing = seen.get(key);
    if (!existing) {
      seen.set(key, {
        ...row,
        name: canonicalizeAirlineName(row.name),
      });
      continue;
    }
    toMerge.push(row.name);
  }

  if (toMerge.length > 0) {
    await Promise.all(
      [...new Set(toMerge.map((n) => n.trim().toLowerCase()))].map((key) => {
        const keeper = seen.get(key);
        return keeper ? mergeDuplicateProfiles(keeper.name) : Promise.resolve(null);
      })
    );
  }

  return Array.from(seen.values())
    .sort((a, b) => a.name.localeCompare(b.name))
    .slice(0, limit);
}

export async function listAirlineCatalog(search?: string) {
  const airlines = await prisma.airlineProfile.findMany({
    where: search
      ? {
          OR: [
            { name: { contains: search, mode: "insensitive" } },
            { iataCode: { contains: search, mode: "insensitive" } },
          ],
        }
      : undefined,
    orderBy: { name: "asc" },
  });

  const bookingGroups = await prisma.flightBooking.groupBy({
    by: ["airline"],
    _count: { _all: true },
  });
  const countByAirline = new Map<string, number>();
  for (const row of bookingGroups) {
    const key = row.airline.trim().toLowerCase();
    countByAirline.set(key, (countByAirline.get(key) || 0) + row._count._all);
  }

  return airlines.map((airline) => ({
    ...airline,
    bookingCount: countByAirline.get(airline.name.trim().toLowerCase()) || 0,
  }));
}

export async function getAirlineProfile(id: string) {
  const airline = await prisma.airlineProfile.findUnique({ where: { id } });
  if (!airline) return null;

  const recentBookings = await prisma.flightBooking.findMany({
    where: { airline: { equals: airline.name, mode: "insensitive" } },
    orderBy: { booking: { createdAt: "desc" } },
    take: 20,
    include: {
      booking: {
        select: {
          id: true,
          publicRef: true,
          status: true,
          createdAt: true,
          customer: { select: { name: true } },
        },
      },
    },
  });

  return { ...airline, recentBookings };
}

export async function updateAirlineProfile(
  id: string,
  input: { name?: string; iataCode?: string | null; logoUrl?: string | null }
) {
  const existing = await prisma.airlineProfile.findUnique({ where: { id } });
  if (!existing) throw new Error("Airline not found");

  const nextName = input.name !== undefined ? canonicalizeAirlineName(input.name) : existing.name;
  if (!nextName) throw new Error("Airline name is required");

  if (nextName.toLowerCase() !== existing.name.toLowerCase()) {
    const clash = await prisma.airlineProfile.findFirst({
      where: {
        id: { not: id },
        name: { equals: nextName, mode: "insensitive" },
      },
    });
    if (clash) throw new Error("Another airline already uses this name");
  }

  const iataCode =
    input.iataCode !== undefined
      ? input.iataCode?.trim().toUpperCase() || null
      : existing.iataCode;
  const resolvedIata = iataCode || resolveAirlineIata(nextName) || null;
  const logoUrl =
    input.logoUrl !== undefined
      ? input.logoUrl?.trim() || null
      : existing.logoUrl || getAirlineLogoUrl(nextName);

  const updated = await prisma.airlineProfile.update({
    where: { id },
    data: {
      name: nextName,
      iataCode: resolvedIata,
      logoUrl,
    },
  });

  // Keep flight bookings aligned when the display name changes
  if (nextName !== existing.name) {
    await prisma.flightBooking.updateMany({
      where: { airline: { equals: existing.name, mode: "insensitive" } },
      data: {
        airline: nextName,
        airlineLogoUrl: logoUrl,
      },
    });
  } else if (logoUrl !== existing.logoUrl) {
    await prisma.flightBooking.updateMany({
      where: { airline: { equals: nextName, mode: "insensitive" } },
      data: { airlineLogoUrl: logoUrl },
    });
  }

  return updated;
}
