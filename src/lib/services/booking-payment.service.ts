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
import type { BillingType } from "@prisma/client";
import { roundMoney } from "@/lib/payment-allocation";
import { splitWalletAcrossAllocations } from "@/lib/wallet-payment";
import { assertWalletFunds } from "@/lib/services/credit.service";

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
  const reference = input.referenceNumber?.trim() || input.gatewayRef?.trim() || null;

  await prisma.$transaction(async (tx) => {
    await tx.payment.create({
      data: {
        bookingId,
        amount: input.amount,
        method: input.method,
        gatewayRef: reference,
        referenceNumber: reference,
        note: input.note?.trim() || null,
        billingType: input.billingType || booking.billingType,
        status: "PAID",
        paidAt,
        createdById: userId,
      },
    });

    await tx.booking.update({
      where: { id: bookingId },
      data: { paymentStatus: newPaymentStatus as PaymentStatus },
    });
  });

  if (booking.billingType === "LEDGER" || creditDebit) {
    await recordCreditTransaction({
      customerId: booking.customerId,
      bookingId,
      type: "CREDIT",
      amount: input.amount,
      note:
        input.note?.trim() ||
        `Payment for ${booking.publicRef} via ${input.method}${reference ? ` (Ref: ${reference})` : ""}`,
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

export interface BookingPaymentAllocation {
  bookingId: string;
  amount: number;
}

export async function recordAllocatedBookingPayments(
  input: {
    billingType: BillingType;
    customerId?: string;
    walletAmount?: number;
    allocations: BookingPaymentAllocation[];
    method: RecordBookingPaymentInput["method"];
    referenceNumber?: string;
    note?: string;
    paidAt?: string;
    billingTypeOverride?: BillingType;
  },
  userId: string
) {
  if (!input.allocations.length) throw new Error("Add at least one bill allocation");

  const walletAmount = roundMoney(input.walletAmount || 0);
  const allocTotal = roundMoney(input.allocations.reduce((s, a) => s + a.amount, 0));
  const receiptForBills = roundMoney(Math.max(0, allocTotal - walletAmount));

  if (walletAmount > 0) {
    if (input.billingType !== "LEDGER" || !input.customerId) {
      throw new Error("Wallet balance can only be used for ledger customers");
    }
    await assertWalletFunds(input.customerId, walletAmount);
  }

  if (receiptForBills > 0 && input.method === "Wallet Balance") {
    throw new Error("Select a receipt payment method for the bank/cash portion");
  }

  const splits = splitWalletAcrossAllocations(input.allocations, walletAmount);

  const bookingIds = [...new Set(input.allocations.map((a) => a.bookingId))];
  const bookings = await prisma.booking.findMany({
    where: { id: { in: bookingIds } },
    include: { payments: true, customer: { select: { id: true, name: true } } },
  });

  if (bookings.length !== bookingIds.length) throw new Error("One or more bookings not found");

  const bookingMap = new Map(bookings.map((b) => [b.id, b]));
  const paidAt = input.paidAt ? new Date(input.paidAt) : new Date();
  const reference = input.referenceNumber?.trim() || null;
  const notePrefix = input.note?.trim() || null;

  for (const alloc of input.allocations) {
    const booking = bookingMap.get(alloc.bookingId)!;
    if (booking.billingType !== input.billingType) {
      throw new Error(`${booking.publicRef} is a ${booking.billingType} bill`);
    }
    if (booking.status === "CANCELLED") {
      throw new Error(`Cannot pay cancelled booking ${booking.publicRef}`);
    }
    const due = computeAmountDue(Number(booking.totalAmount), sumPaidPayments(booking.payments));
    if (alloc.amount > due) {
      throw new Error(`Amount exceeds due for ${booking.publicRef} (${due.toLocaleString("en-IN")})`);
    }
  }

  const results: {
    bookingId: string;
    publicRef: string;
    amount: number;
    paymentStatus: PaymentStatus;
    amountDue: number;
  }[] = [];

  await prisma.$transaction(async (tx) => {
    for (const split of splits) {
      const booking = bookingMap.get(split.bookingId)!;
      const totalAmount = Number(booking.totalAmount);
      const paidSoFar = sumPaidPayments(booking.payments);
      const hasCreditCharge = bookingHasCreditCharge(booking.payments);
      const newPaidTotal = roundMoney(paidSoFar + split.amount);
      const newPaymentStatus = deriveBookingPaymentStatus(totalAmount, newPaidTotal, hasCreditCharge);

      if (split.wallet > 0) {
        await tx.payment.create({
          data: {
            bookingId: split.bookingId,
            customerId: input.customerId,
            amount: split.wallet,
            method: "Wallet Balance",
            referenceNumber: null,
            note: notePrefix || `Agst wallet - ${booking.publicRef}`,
            billingType: input.billingTypeOverride || booking.billingType,
            status: "PAID",
            paidAt,
            createdById: userId,
          },
        });
      }

      if (split.received > 0) {
        await tx.payment.create({
          data: {
            bookingId: split.bookingId,
            customerId: input.customerId,
            amount: split.received,
            method: input.method,
            gatewayRef: reference,
            referenceNumber: reference,
            note: notePrefix || `Agst Ref ${booking.publicRef}`,
            billingType: input.billingTypeOverride || booking.billingType,
            status: "PAID",
            paidAt,
            createdById: userId,
          },
        });
      }

      await tx.booking.update({
        where: { id: split.bookingId },
        data: { paymentStatus: newPaymentStatus as PaymentStatus },
      });

      results.push({
        bookingId: split.bookingId,
        publicRef: booking.publicRef,
        amount: split.amount,
        paymentStatus: newPaymentStatus as PaymentStatus,
        amountDue: computeAmountDue(totalAmount, newPaidTotal),
      });
    }
  });

  for (const split of splits) {
    const booking = bookingMap.get(split.bookingId)!;
    if (booking.billingType === "LEDGER") {
      await recordCreditTransaction({
        customerId: booking.customerId,
        bookingId: split.bookingId,
        type: "CREDIT",
        amount: split.amount,
        note:
          notePrefix ||
          `Settlement Agst Ref ${booking.publicRef}` +
            (split.wallet > 0 ? ` (wallet ${split.wallet.toLocaleString("en-IN")}` : "") +
            (split.received > 0
              ? `${split.wallet > 0 ? " + " : " ("}receipt ${split.received.toLocaleString("en-IN")} via ${input.method}${reference ? ` Ref: ${reference}` : ""}`
              : split.wallet > 0
                ? ")"
                : ` via ${input.method}${reference ? ` Ref: ${reference}` : ""})`),
        createdById: userId,
      });
    }

    await logActivity({
      bookingId: split.bookingId,
      userId,
      action: "PAYMENT_RECORDED",
      details: {
        amount: split.amount,
        walletAmount: split.wallet,
        receivedAmount: split.received,
        method: input.method,
        referenceNumber: reference,
        batchTotal: allocTotal,
        allocatedBills: input.allocations.length,
      },
    });
  }

  return {
    walletAmount,
    receiptForBills,
    allocatedTotal: allocTotal,
    allocations: results,
    referenceNumber: reference,
  };
}
