import { prisma } from "@/lib/db";
import type { Prisma } from "@prisma/client";

type DbClient = Prisma.TransactionClient | typeof prisma;

export function formatPublicRef(year: number, serialNumber: number) {
  return `FB-${year}-${String(serialNumber).padStart(6, "0")}`;
}

export function parsePublicRef(publicRef: string): { year: number; serialNumber: number } | null {
  const match = /^FB-(\d{4})-(\d+)$/.exec(publicRef);
  if (!match) return null;
  return { year: Number(match[1]), serialNumber: Number(match[2]) };
}

/** Allocate next serial for the current year (transaction-safe). */
export async function allocatePublicRef(tx: DbClient = prisma) {
  const year = new Date().getFullYear();

  const counter = await tx.bookingSerialCounter.upsert({
    where: { year },
    create: { year, lastNumber: 1 },
    update: { lastNumber: { increment: 1 } },
  });

  const serialNumber = counter.lastNumber;
  return {
    publicRef: formatPublicRef(year, serialNumber),
    serialYear: year,
    serialNumber,
  };
}

/** Backfill serialYear/serialNumber from publicRef for legacy rows. */
export async function backfillBookingSerials() {
  const bookings = await prisma.booking.findMany({
    where: { serialNumber: null },
    select: { id: true, publicRef: true },
  });

  for (const b of bookings) {
    const parsed = parsePublicRef(b.publicRef);
    if (!parsed) continue;
    await prisma.booking.update({
      where: { id: b.id },
      data: { serialYear: parsed.year, serialNumber: parsed.serialNumber },
    });
  }

  const byYear = await prisma.booking.groupBy({
    by: ["serialYear"],
    where: { serialYear: { not: null } },
    _max: { serialNumber: true },
  });

  for (const row of byYear) {
    if (row.serialYear == null) continue;
    const maxNum = row._max.serialNumber ?? 0;
    await prisma.bookingSerialCounter.upsert({
      where: { year: row.serialYear },
      create: { year: row.serialYear, lastNumber: maxNum },
      update: { lastNumber: Math.max(maxNum, 0) },
    });
  }
}

export async function generatePublicRef(): Promise<string> {
  const { publicRef } = await allocatePublicRef();
  return publicRef;
}
