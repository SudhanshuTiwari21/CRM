import fs from "fs/promises";
import { prisma } from "@/lib/db";
import type { Prisma } from "@prisma/client";
import { formatPublicRef, parsePublicRef } from "@/lib/booking-ref";
import { logActivity } from "./activity.service";
import { generateBookingDocuments } from "./document.service";

export interface AdminBookingUpdateInput {
  pnr?: string;
  internalNotes?: string;
  totalAmount?: number;
  invoiceNarration?: string;
  showPassengerName?: boolean;
  baseFare?: number;
  serviceCharge?: number;
  discountAmount?: number;
  regenerateDocuments?: boolean;
}

export async function updateBookingAsAdmin(
  bookingId: string,
  input: AdminBookingUpdateInput,
  userId: string
) {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { flightBooking: true, hotelBooking: true },
  });
  if (!booking) throw new Error("Booking not found");

  const bookingData: Record<string, unknown> = {
    lastEditedAt: new Date(),
    lastEditedById: userId,
  };
  if (input.pnr !== undefined) bookingData.pnr = input.pnr || null;
  if (input.internalNotes !== undefined) bookingData.internalNotes = input.internalNotes;
  if (input.totalAmount !== undefined) bookingData.totalAmount = input.totalAmount;

  const flightData: Record<string, unknown> = {};
  if (booking.flightBooking) {
    if (input.invoiceNarration !== undefined) flightData.invoiceNarration = input.invoiceNarration;
    if (input.showPassengerName !== undefined) flightData.showPassengerName = input.showPassengerName;
    if (input.baseFare !== undefined) flightData.baseFare = input.baseFare;
    if (input.serviceCharge !== undefined) flightData.serviceCharge = input.serviceCharge;
    if (input.discountAmount !== undefined) flightData.discountAmount = input.discountAmount;
  }

  if (booking.hotelBooking && input.invoiceNarration !== undefined) {
    await prisma.hotelBooking.update({
      where: { bookingId },
      data: { agentRemarks: input.invoiceNarration },
    });
  }

  await prisma.booking.update({
    where: { id: bookingId },
    data: bookingData,
  });

  if (booking.flightBooking && Object.keys(flightData).length > 0) {
    await prisma.flightBooking.update({
      where: { bookingId },
      data: flightData,
    });
  }

  await logActivity({
    bookingId,
    userId,
    action: "BOOKING_EDITED",
    details: { ...input } as Prisma.InputJsonValue,
  });

  if (input.regenerateDocuments !== false) {
    await generateBookingDocuments(bookingId, userId);
  }

  return prisma.booking.findUnique({
    where: { id: bookingId },
    include: { customer: true, flightBooking: true, hotelBooking: true, documents: true },
  });
}

export async function deleteBookingWithRenumber(bookingId: string, userId: string) {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { documents: true, customer: true },
  });
  if (!booking) throw new Error("Booking not found");

  let serialYear = booking.serialYear;
  let serialNumber = booking.serialNumber;
  if (serialYear == null || serialNumber == null) {
    const parsed = parsePublicRef(booking.publicRef);
    if (!parsed) throw new Error("Cannot parse booking serial from public ref");
    serialYear = parsed.year;
    serialNumber = parsed.serialNumber;
    await prisma.booking.update({
      where: { id: bookingId },
      data: { serialYear, serialNumber },
    });
  }

  const deletedRef = booking.publicRef;

  // Remove PDF files from disk
  for (const doc of booking.documents) {
    try {
      await fs.unlink(doc.storagePath);
    } catch {
      // file may already be missing
    }
  }

  const renumberedIds: string[] = [];

  await prisma.$transaction(async (tx) => {
    // Reverse credit if booking was on credit
    if (booking.paymentStatus === "ON_CREDIT") {
      const customer = await tx.customer.findUnique({ where: { id: booking.customerId } });
      if (customer) {
        const amount = Number(booking.totalAmount);
        const balanceAfter = Math.round((Number(customer.creditBalance) - amount) * 100) / 100;
        await tx.customer.update({
          where: { id: booking.customerId },
          data: { creditBalance: Math.max(0, balanceAfter) },
        });
        await tx.customerCreditTransaction.create({
          data: {
            customerId: booking.customerId,
            bookingId: booking.id,
            type: "REFUND",
            amount,
            balanceAfter: Math.max(0, balanceAfter),
            note: `Booking ${deletedRef} deleted`,
            createdById: userId,
          },
        });
      }
    }

    await tx.booking.delete({ where: { id: bookingId } });

    const later = await tx.booking.findMany({
      where: { serialYear, serialNumber: { gt: serialNumber } },
      orderBy: { serialNumber: "asc" },
      include: { documents: true },
    });

    for (const b of later) {
      const newNum = b.serialNumber! - 1;
      const newRef = formatPublicRef(serialYear, newNum);
      await tx.booking.update({
        where: { id: b.id },
        data: { serialNumber: newNum, publicRef: newRef },
      });
      renumberedIds.push(b.id);
    }
  });

  for (const id of renumberedIds) {
    await generateBookingDocuments(id, userId);
  }

  await logActivity({
    userId,
    action: "BOOKING_DELETED",
    details: { deletedRef, serialYear, serialNumber },
  });

  return { deletedRef, renumbered: renumberedIds.length };
}
