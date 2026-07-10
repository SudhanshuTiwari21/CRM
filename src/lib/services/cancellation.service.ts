import { prisma } from "@/lib/db";
import type { BookingStatus, CancellationCategory, Prisma } from "@prisma/client";
import {
  canCancelProductType,
  computeB2BNetRefund,
  resolveCancellationCategory,
} from "@/lib/cancellation-category";
import { logActivity } from "./activity.service";
import { createCreditNote } from "./credit-note.service";
import { recordCreditTransaction } from "./credit.service";
import type { BookingCancelInput } from "@/lib/validators/booking-cancel";

const CANCELLABLE_STATUSES: BookingStatus[] = ["PROCESSING", "CONFIRMED", "TICKET_SENT", "FAILED"];

export async function cancelBooking(bookingId: string, input: BookingCancelInput, userId: string) {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: {
      customer: true,
      flightBooking: true,
      hotelBooking: true,
      cancellation: true,
    },
  });

  if (!booking) throw new Error("Booking not found");
  if (!canCancelProductType(booking.productType)) {
    throw new Error("Cancellation is only supported for flight and hotel bookings");
  }
  if (booking.status === "CANCELLED" || booking.cancellation) {
    throw new Error("Booking is already cancelled");
  }
  if (!CANCELLABLE_STATUSES.includes(booking.status)) {
    throw new Error(`Cannot cancel booking in ${booking.status} status`);
  }

  const expectedCategory = resolveCancellationCategory(booking);
  if (input.category !== expectedCategory) {
    throw new Error(`This booking is classified as ${expectedCategory}. Use the matching cancellation form.`);
  }

  const refundAmount =
    input.category === "B2B"
      ? computeB2BNetRefund(
          input.airlineRefund ?? 0,
          input.supplierCharges ?? 0,
          input.agencyCharges ?? 0
        )
      : input.customerRefund ?? 0;

  const cancellation = await prisma.$transaction(async (tx) => {
    const created = await tx.bookingCancellation.create({
      data: {
        bookingId,
        category: input.category,
        reason: input.reason,
        airlineRefund: input.category === "B2B" ? input.airlineRefund ?? 0 : null,
        supplierCharges: input.category === "B2B" ? input.supplierCharges ?? 0 : null,
        agencyCharges: input.category === "B2B" ? input.agencyCharges ?? 0 : null,
        customerRefund: input.category === "B2C" ? input.customerRefund ?? 0 : null,
        cancellationFee: input.category === "B2C" ? input.cancellationFee ?? 0 : null,
        supplierPenalty: input.category === "B2C" ? input.supplierPenalty ?? 0 : null,
        refundToCredit: input.refundToCredit ?? false,
        notes: input.notes || null,
        cancelledById: userId,
      },
    });

    await tx.booking.update({
      where: { id: bookingId },
      data: {
        status: "CANCELLED",
        paymentStatus: refundAmount > 0 ? "REFUNDED" : booking.paymentStatus,
        lastEditedAt: new Date(),
        lastEditedById: userId,
      },
    });

    return created;
  });

  if (refundAmount > 0) {
    await createCreditNote({
      customerId: booking.customerId,
      bookingId,
      cancellationId: cancellation.id,
      amount: refundAmount,
      billingType: booking.billingType,
      reason: input.reason,
      notes: input.notes,
      source: "AUTO_CANCEL",
      createdById: userId,
    });
  }

  if (input.refundToCredit && refundAmount > 0) {
    await recordCreditTransaction({
      customerId: booking.customerId,
      bookingId,
      type: "REFUND",
      amount: refundAmount,
      note: `Cancellation refund for ${booking.publicRef}`,
      createdById: userId,
    });
  }

  await logActivity({
    bookingId,
    userId,
    action: "BOOKING_CANCELLED",
    details: {
      publicRef: booking.publicRef,
      category: input.category,
      reason: input.reason,
      refundAmount,
      refundToCredit: input.refundToCredit ?? false,
    },
  });

  return cancellation;
}

export async function listCancellations(params: {
  page?: number;
  limit?: number;
  category?: CancellationCategory;
  productType?: "FLIGHT" | "HOTEL";
  search?: string;
}) {
  const page = params.page ?? 1;
  const limit = params.limit ?? 20;

  const where: Prisma.BookingCancellationWhereInput = {};
  if (params.category) where.category = params.category;

  const bookingWhere: Prisma.BookingWhereInput = { status: "CANCELLED" };
  if (params.productType) bookingWhere.productType = params.productType;
  if (params.search) {
    bookingWhere.OR = [
      { publicRef: { contains: params.search, mode: "insensitive" } },
      { pnr: { contains: params.search, mode: "insensitive" } },
      { customer: { name: { contains: params.search, mode: "insensitive" } } },
    ];
  }
  where.booking = bookingWhere;

  const [cancellations, total] = await Promise.all([
    prisma.bookingCancellation.findMany({
      where,
      include: {
        booking: {
          include: {
            customer: true,
            flightBooking: { select: { airline: true, invoiceTaxType: true } },
            hotelBooking: { select: { propertyName: true, confirmationNo: true } },
          },
        },
        cancelledBy: { select: { name: true } },
      },
      orderBy: { cancelledAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.bookingCancellation.count({ where }),
  ]);

  return { cancellations, total, page, limit, totalPages: Math.ceil(total / limit) };
}
