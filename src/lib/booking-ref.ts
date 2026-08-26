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

/** Allocate next serial for the current brand + year (transaction-safe). */
export async function allocatePublicRef(tx: DbClient = prisma, brandId?: CrmBrand) {
  const year = new Date().getFullYear();
  const brand = brandId ?? (await getActiveDbBrand());

  const counter = await tx.bookingSerialCounter.upsert({
    where: { brandId_year: { brandId: brand, year } },
    create: { brandId: brand, year, lastNumber: 1 },
    update: { lastNumber: { increment: 1 } },
  });

  const serialNumber = counter.lastNumber;
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
