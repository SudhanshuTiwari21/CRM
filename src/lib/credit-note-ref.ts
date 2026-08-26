import { prisma } from "@/lib/db";
import type { CrmBrand, Prisma } from "@prisma/client";
import { getActiveDbBrand } from "@/lib/brand-context";

type DbClient = Prisma.TransactionClient | typeof prisma;

export function formatCreditNoteRef(year: number, serialNumber: number) {
  return `CN-${year}-${String(serialNumber).padStart(6, "0")}`;
}

export async function allocateCreditNoteRef(tx: DbClient = prisma, brandId?: CrmBrand) {
  const year = new Date().getFullYear();
  const brand = brandId ?? (await getActiveDbBrand());
  const counter = await tx.creditNoteSerialCounter.upsert({
    where: { brandId_year: { brandId: brand, year } },
    create: { brandId: brand, year, lastNumber: 1 },
    update: { lastNumber: { increment: 1 } },
  });
  const serialNumber = counter.lastNumber;
  return {
    publicRef: formatCreditNoteRef(year, serialNumber),
    serialYear: year,
    serialNumber,
    brandId: brand,
  };
}
