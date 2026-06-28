import { prisma } from "@/lib/db";
import type { PaymentStatus } from "@prisma/client";
import {
  bookingHasCreditCharge,
  computeAmountDue,
  deriveBookingPaymentStatus,
  sumPaidPayments,
} from "@/lib/payment-utils";
import { recordCreditTransaction } from "@/lib/services/credit.service";
import { logActivity } from "@/lib/services/activity.service";
import type { RecordBookingPaymentInput } from "@/lib/validators/payment";

export async function recordBookingPayment(
  bookingId: string,
  input: RecordBookingPaymentInput,
  userId: string
) {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: {
      payments: true,
      customer: { select: { id: true, creditEnabled: true } },
    },
  });

  if (!booking) throw new Error("Booking not found");
  if (booking.status === "CANCELLED") throw new Error("Cannot record payment on a cancelled booking");

  const totalAmount = Number(booking.totalAmount);
  const paidSoFar = sumPaidPayments(booking.payments);
  const amountDue = computeAmountDue(totalAmount, paidSoFar);

  if (amountDue <= 0) throw new Error("This booking is already fully paid");
  if (input.amount > amountDue) {
    throw new Error(`Amount exceeds balance due (${amountDue.toLocaleString("en-IN")})`);
  }

  const hasCreditCharge = bookingHasCreditCharge(booking.payments);
  const creditDebit = hasCreditCharge
    ? await prisma.customerCreditTransaction.findFirst({
        where: { bookingId, type: "DEBIT" },
      })
    : null;

  const paidAt = input.paidAt ? new Date(input.paidAt) : new Date();
  const newPaidTotal = paidSoFar + input.amount;
  const newPaymentStatus = deriveBookingPaymentStatus(totalAmount, newPaidTotal, hasCreditCharge);

  await prisma.$transaction(async (tx) => {
    await tx.payment.create({
      data: {
        bookingId,
        amount: input.amount,
        method: input.method,
        gatewayRef: input.gatewayRef?.trim() || null,
        status: "PAID",
        paidAt,
      },
    });

    await tx.booking.update({
      where: { id: bookingId },
      data: { paymentStatus: newPaymentStatus as PaymentStatus },
    });
  });

  if (creditDebit) {
    await recordCreditTransaction({
      customerId: booking.customerId,
      bookingId,
      type: "CREDIT",
      amount: input.amount,
      note: input.note?.trim() || `Payment for ${booking.publicRef} via ${input.method}`,
      createdById: userId,
    });
  }

  const updated = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { payments: { orderBy: { paidAt: "desc" } } },
  });

  await logActivity({
    bookingId,
    userId,
    action: "PAYMENT_RECORDED",
    details: {
      amount: input.amount,
      method: input.method,
      gatewayRef: input.gatewayRef || null,
      paymentStatus: newPaymentStatus,
      paidTotal: newPaidTotal,
      amountDue: computeAmountDue(totalAmount, newPaidTotal),
    },
  });

  return {
    booking: updated!,
    paidAmount: newPaidTotal,
    amountDue: computeAmountDue(totalAmount, newPaidTotal),
    paymentStatus: newPaymentStatus,
  };
}
