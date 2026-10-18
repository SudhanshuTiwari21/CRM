import { prisma } from "@/lib/db";
import type { CrmBrand, Prisma } from "@prisma/client";
import { getActiveDbBrand } from "@/lib/brand-context";

type DbClient = Prisma.TransactionClient | typeof prisma;

export function formatPublicRef(year: number, serialNumber: number) {
  return `FB-${year}-${String(serialNumber).padStart(6, "0")}`;
}

export function parsePublicRef(publicRef: string): { year: number; serialNumber: number } | null {
  const match = /^FB-(\d{4})-(\d+)$/.exec(publicRef);
  if (!match) return null;
  return { year: Number(match[1]), serialNumber: Number(match[2]) };
}

/**
 * Allocate next serial for the current brand + year (transaction-safe).
 * Syncs the counter to the max existing booking serial so a missing/reset
 * counter never reissues an already-used publicRef.
 */
export async function allocatePublicRef(tx: DbClient = prisma, brandId?: CrmBrand) {
  const year = new Date().getFullYear();
  const brand = brandId ?? (await getActiveDbBrand());

  const maxExisting = await tx.booking.aggregate({
    where: { brandId: brand, serialYear: year },
    _max: { serialNumber: true },
  });
  const maxUsed = maxExisting._max.serialNumber ?? 0;

  // Also cover legacy rows that have publicRef but null serialYear/serialNumber
  const legacyMax = await tx.booking.findMany({
    where: {
      brandId: brand,
      OR: [{ serialYear: null }, { serialNumber: null }],
      publicRef: { startsWith: `FB-${year}-` },
    },
    select: { publicRef: true },
  });
  let maxFromLegacy = 0;
  for (const row of legacyMax) {
    const parsed = parsePublicRef(row.publicRef);
    if (parsed && parsed.year === year && parsed.serialNumber > maxFromLegacy) {
      maxFromLegacy = parsed.serialNumber;
    }
  }

  const floor = Math.max(maxUsed, maxFromLegacy);

  const existing = await tx.bookingSerialCounter.findUnique({
    where: { brandId_year: { brandId: brand, year } },
  });

  let serialNumber: number;
  if (!existing) {
    serialNumber = floor + 1;
    await tx.bookingSerialCounter.create({
      data: { brandId: brand, year, lastNumber: serialNumber },
    });
  } else {
    serialNumber = Math.max(existing.lastNumber, floor) + 1;
    await tx.bookingSerialCounter.update({
      where: { brandId_year: { brandId: brand, year } },
      data: { lastNumber: serialNumber },
    });
  }

  return {
    publicRef: formatPublicRef(year, serialNumber),
    serialYear: year,
    serialNumber,
    brandId: brand,
  };
}

export async function generatePublicRef(): Promise<string> {
  const { publicRef } = await allocatePublicRef();
  return publicRef;
}
