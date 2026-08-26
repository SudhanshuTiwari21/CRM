import { prisma } from "@/lib/db";
import type { CrmBrand, Prisma } from "@prisma/client";
import { getActiveDbBrand } from "@/lib/brand-context";

type DbClient = Prisma.TransactionClient | typeof prisma;

/** helloGTX-style query reference: Q/26/2133545 */
export function formatQueryRef(year: number, serialNumber: number) {
  const yy = String(year).slice(-2);
  return `Q/${yy}/${serialNumber}`;
}

export function parseQueryRef(queryRef: string): { year: number; serialNumber: number } | null {
  const match = /^Q\/(\d{2})\/(\d+)$/.exec(queryRef);
  if (!match) return null;
  const yy = Number(match[1]);
  const serialNumber = Number(match[2]);
  const century = yy >= 70 ? 1900 : 2000;
  return { year: century + yy, serialNumber };
}

export async function allocateQueryRef(tx: DbClient = prisma, brandId?: CrmBrand) {
  const year = new Date().getFullYear();
  const brand = brandId ?? (await getActiveDbBrand());

  const counter = await tx.leadSerialCounter.upsert({
    where: { brandId_year: { brandId: brand, year } },
    create: { brandId: brand, year, lastNumber: 1 },
    update: { lastNumber: { increment: 1 } },
  });

  const serialNumber = counter.lastNumber;
  return {
    queryRef: formatQueryRef(year, serialNumber),
    serialYear: year,
    serialNumber,
    brandId: brand,
  };
}

/** Backfill queryRef for legacy leads missing serial fields. */
export async function backfillLeadQueryRefs() {
  const brand = await getActiveDbBrand();
  const leads = await prisma.lead.findMany({
    where: { brandId: brand, queryRef: null },
    select: { id: true },
    orderBy: { createdAt: "asc" },
  });

  for (const lead of leads) {
    const ref = await allocateQueryRef(prisma, brand);
    await prisma.lead.update({
      where: { id: lead.id },
      data: {
        queryRef: ref.queryRef,
        serialYear: ref.serialYear,
        serialNumber: ref.serialNumber,
      },
    });
  }

  return { backfilled: leads.length };
}
