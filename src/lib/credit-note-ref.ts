import { prisma } from "@/lib/db";
import type { Prisma } from "@prisma/client";

type DbClient = Prisma.TransactionClient | typeof prisma;

export function formatCreditNoteRef(year: number, serialNumber: number) {
  return `CN-${year}-${String(serialNumber).padStart(6, "0")}`;
}

export async function allocateCreditNoteRef(tx: DbClient = prisma) {
  const year = new Date().getFullYear();
  const counter = await tx.creditNoteSerialCounter.upsert({
    where: { year },
    create: { year, lastNumber: 1 },
    update: { lastNumber: { increment: 1 } },
  });
  const serialNumber = counter.lastNumber;
  return {
    publicRef: formatCreditNoteRef(year, serialNumber),
    serialYear: year,
    serialNumber,
  };
}
