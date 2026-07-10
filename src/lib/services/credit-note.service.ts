import { prisma } from "@/lib/db";
import type { BillingType, CreditNoteSource, Prisma } from "@prisma/client";
import { allocateCreditNoteRef } from "@/lib/credit-note-ref";
import { logActivity } from "./activity.service";

export async function createCreditNote(params: {
  customerId: string;
  amount: number;
  bookingId?: string;
  cancellationId?: string;
  billingType?: BillingType;
  reason?: string;
  notes?: string;
  source?: CreditNoteSource;
  createdById?: string;
}) {
  if (params.amount <= 0) throw new Error("Credit note amount must be greater than zero");

  const note = await prisma.$transaction(async (tx) => {
    const { publicRef, serialYear, serialNumber } = await allocateCreditNoteRef(tx);
    return tx.creditNote.create({
      data: {
        publicRef,
        serialYear,
        serialNumber,
        customerId: params.customerId,
        bookingId: params.bookingId,
        cancellationId: params.cancellationId,
        amount: params.amount,
        billingType: params.billingType,
        reason: params.reason,
        notes: params.notes,
        source: params.source || "MANUAL",
        createdById: params.createdById,
      },
      include: {
        customer: { select: { name: true } },
        booking: { select: { publicRef: true } },
      },
    });
  });

  if (params.bookingId) {
    await logActivity({
      bookingId: params.bookingId,
      userId: params.createdById,
      action: "CREDIT_NOTE_CREATED",
      details: {
        publicRef: note.publicRef,
        amount: params.amount,
        source: params.source || "MANUAL",
      },
    });
  }

  return note;
}

export async function listCreditNotes(params: {
  page?: number;
  limit?: number;
  customerId?: string;
  search?: string;
}) {
  const page = params.page ?? 1;
  const limit = params.limit ?? 20;
  const where: Prisma.CreditNoteWhereInput = {};

  if (params.customerId) where.customerId = params.customerId;
  if (params.search?.trim()) {
    where.OR = [
      { publicRef: { contains: params.search, mode: "insensitive" } },
      { customer: { name: { contains: params.search, mode: "insensitive" } } },
      { booking: { publicRef: { contains: params.search, mode: "insensitive" } } },
    ];
  }

  const [creditNotes, total] = await Promise.all([
    prisma.creditNote.findMany({
      where,
      include: {
        customer: { select: { id: true, name: true, phone: true } },
        booking: { select: { id: true, publicRef: true, productType: true } },
        createdBy: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.creditNote.count({ where }),
  ]);

  return { creditNotes, total, page, limit, totalPages: Math.ceil(total / limit) };
}
