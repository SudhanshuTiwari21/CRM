import { prisma } from "@/lib/db";
import type { DocumentType, Prisma, ProductType } from "@prisma/client";
import { bookingMatchesPassengerSearch, collectPassengerNames } from "@/lib/document-passengers";

export type DocumentCategory = "all" | "flight-ticket" | "hotel-voucher" | "bus-ticket" | "invoice";

export type ListDocumentsParams = {
  category?: DocumentCategory;
  bookingRef?: string;
  passenger?: string;
  from?: string;
  to?: string;
  limit?: number;
};

function startOfDay(dateStr: string) {
  const d = new Date(`${dateStr}T00:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function endOfDay(dateStr: string) {
  const d = new Date(`${dateStr}T23:59:59.999`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function categoryWhere(category: DocumentCategory): Prisma.DocumentWhereInput | null {
  switch (category) {
    case "flight-ticket":
      return { type: "TICKET", booking: { productType: "FLIGHT" } };
    case "hotel-voucher":
      return { type: "VOUCHER", booking: { productType: "HOTEL" } };
    case "bus-ticket":
      return { type: "TICKET", booking: { productType: "BUS" } };
    case "invoice":
      return { type: "INVOICE" };
    default:
      return null;
  }
}

export async function listDocuments(params: ListDocumentsParams = {}) {
  const category = params.category || "all";
  const limit = params.limit ?? 100;
  const passengerQuery = params.passenger?.trim() || "";

  const where: Prisma.DocumentWhereInput = {};
  const bookingWhere: Prisma.BookingWhereInput = {};

  const categoryFilter = categoryWhere(category);
  if (categoryFilter?.type) {
    where.type = categoryFilter.type as DocumentType;
  }
  if (categoryFilter?.booking && typeof categoryFilter.booking === "object") {
    Object.assign(bookingWhere, categoryFilter.booking);
  }

  if (params.bookingRef?.trim()) {
    bookingWhere.publicRef = { contains: params.bookingRef.trim(), mode: "insensitive" };
  }

  if (Object.keys(bookingWhere).length > 0) {
    where.booking = bookingWhere;
  }

  if (params.from || params.to) {
    where.generatedAt = {};
    const from = params.from ? startOfDay(params.from) : null;
    const to = params.to ? endOfDay(params.to) : null;
    if (from) where.generatedAt.gte = from;
    if (to) where.generatedAt.lte = to;
  }

  const fetchLimit = passengerQuery ? Math.max(limit, 300) : limit;

  const rows = await prisma.document.findMany({
    where,
    include: {
      booking: {
        select: {
          id: true,
          publicRef: true,
          productType: true,
          customer: { select: { name: true } },
          flightBooking: { select: { passengers: true } },
          hotelBooking: { select: { guests: true } },
          busBooking: { select: { passengers: true } },
        },
      },
    },
    orderBy: { generatedAt: "desc" },
    take: fetchLimit,
  });

  const filtered = passengerQuery
    ? rows.filter((row) => bookingMatchesPassengerSearch(row.booking, passengerQuery))
    : rows;

  return filtered.slice(0, limit).map((doc) => ({
    id: doc.id,
    fileName: doc.fileName,
    type: doc.type,
    generatedAt: doc.generatedAt.toISOString(),
    bookingId: doc.bookingId,
    publicRef: doc.booking.publicRef,
    productType: doc.booking.productType as ProductType,
    passengerNames: collectPassengerNames(doc.booking),
  }));
}
