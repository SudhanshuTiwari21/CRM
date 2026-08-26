import { prisma } from "@/lib/db";
import type { BillingType } from "@prisma/client";
import { recordAllocatedBookingPayments, recordBookingPayment } from "@/lib/services/booking-payment.service";
import { surplusToAdvance } from "@/lib/payment-surplus";
import { roundMoney } from "@/lib/payment-allocation";
import { recordCreditTransaction } from "@/lib/services/credit.service";
import { logActivity } from "@/lib/services/activity.service";
import type { RecordPaymentInput } from "@/lib/validators/payments-hub";
import { getActiveDbBrand } from "@/lib/brand-context";

export async function recordAdvancePayment(
  input: Extract<RecordPaymentInput, { target: "ADVANCE" }>,
  userId: string
) {
  const customer = await prisma.customer.findUnique({ where: { id: input.customerId } });
  if (!customer) throw new Error("Customer not found");

  const paidAt = input.paidAt ? new Date(input.paidAt) : new Date();
  const reference = input.referenceNumber?.trim() || null;
  const note =
    input.note?.trim() ||
    `Advance payment via ${input.method}${reference ? ` (Ref: ${reference})` : ""}`;

  const payment = await prisma.$transaction(async (tx) => {
    const brandId = await getActiveDbBrand();
    const created = await tx.payment.create({
      data: {
        brandId,
        customerId: input.customerId,
        amount: input.amount,
        method: input.method,
        gatewayRef: reference,
        referenceNumber: reference,
        note,
        billingType: "LEDGER",
        status: "PAID",
        paidAt,
        createdById: userId,
      },
      include: {
        customer: { select: { id: true, name: true, creditBalance: true } },
        createdBy: { select: { name: true } },
      },
    });

    return created;
  });

  await recordCreditTransaction({
    customerId: input.customerId,
    type: "CREDIT",
    amount: input.amount,
    note,
    createdById: userId,
  });

  const updatedCustomer = await prisma.customer.findUnique({
    where: { id: input.customerId },
    select: { creditBalance: true },
  });

  await logActivity({
    userId,
    action: "ADVANCE_PAYMENT",
    details: {
      customerId: input.customerId,
      customerName: customer.name,
      paymentId: payment.id,
      amount: input.amount,
      method: input.method,
      referenceNumber: reference,
      note: input.note || null,
      ledgerBalance: updatedCustomer ? Number(updatedCustomer.creditBalance) : null,
    },
  });

  return {
    success: true,
    payment,
    customerId: input.customerId,
    amount: input.amount,
    ledgerBalance: updatedCustomer ? Number(updatedCustomer.creditBalance) : 0,
  };
}

export async function recordHubPayment(input: RecordPaymentInput, userId: string) {
  if (input.target === "ADVANCE") {
    return recordAdvancePayment(input, userId);
  }

  const walletAmount = roundMoney(input.walletAmount ?? 0);
  const receiptAmount = input.amount;
  const allocations = input.allocations ?? [];
  const allocTotal = roundMoney(allocations.reduce((s, a) => s + a.amount, 0));
  const advanceAmount = surplusToAdvance(receiptAmount, allocTotal, walletAmount);

  if (allocTotal > walletAmount + receiptAmount + 0.01) {
    throw new Error("Allocated amount exceeds payment received plus wallet");
  }

  if (input.billingType === "CASH" && advanceAmount > 0.01) {
    throw new Error("Cash payment must be fully allocated to bills");
  }

  const paymentInput = {
    amount: receiptAmount,
    method: input.method,
    gatewayRef: input.referenceNumber,
    referenceNumber: input.referenceNumber,
    note: input.note,
    paidAt: input.paidAt,
    billingType: input.billingType as BillingType,
  };

  let bookingResult: Awaited<ReturnType<typeof recordAllocatedBookingPayments>> | null = null;

  if (allocations.length > 0) {
    bookingResult = await recordAllocatedBookingPayments(
      {
        billingType: input.billingType as BillingType,
        customerId: input.customerId,
        walletAmount,
        allocations,
        method:
          walletAmount >= allocTotal && allocTotal > 0
            ? "Wallet Balance"
            : input.method,
        referenceNumber: input.referenceNumber,
        note: input.note,
        paidAt: input.paidAt,
      },
      userId
    );
  } else if (input.bookingId) {
    return recordBookingPayment(input.bookingId, paymentInput, userId);
  }

  let advanceResult: Awaited<ReturnType<typeof recordAdvancePayment>> | null = null;
  if (advanceAmount > 0.01) {
    if (input.billingType !== "LEDGER" || !input.customerId) {
      throw new Error("Surplus can only be credited to ledger customer advance");
    }
    advanceResult = await recordAdvancePayment(
      {
        target: "ADVANCE",
        billingType: "LEDGER",
        customerId: input.customerId,
        amount: advanceAmount,
        method: input.method,
        referenceNumber: input.referenceNumber,
        note:
          input.note?.trim() ||
          `Surplus from receipt - auto-credited to advance`,
        paidAt: input.paidAt,
      },
      userId
    );
  } else if (allocTotal === 0 && receiptAmount > 0 && input.billingType === "LEDGER" && input.customerId) {
    advanceResult = await recordAdvancePayment(
      {
        target: "ADVANCE",
        billingType: "LEDGER",
        customerId: input.customerId,
        amount: receiptAmount,
        method: input.method,
        referenceNumber: input.referenceNumber,
        note: input.note,
        paidAt: input.paidAt,
      },
      userId
    );
  }

  const ledgerBalance =
    advanceResult?.ledgerBalance ??
    (input.customerId
      ? Number(
          (
            await prisma.customer.findUnique({
              where: { id: input.customerId },
              select: { creditBalance: true },
            })
          )?.creditBalance ?? 0
        )
      : 0);

  return {
    ...(bookingResult ?? { allocations: [] }),
    advanceCredited: advanceResult ? advanceAmount || receiptAmount : 0,
    ledgerBalance,
    receiptAmount,
    walletAmount,
    allocatedTotal: allocTotal,
  };
}

export async function listPaymentHistory(params: {
  page?: number;
  limit?: number;
  billingType?: BillingType;
}) {
  const page = params.page ?? 1;
  const limit = params.limit ?? 30;
  const brandId = await getActiveDbBrand();

  const where = {
    brandId,
    ...(params.billingType ? { billingType: params.billingType } : {}),
  };

  const [payments, total] = await Promise.all([
    prisma.payment.findMany({
      where,
      include: {
        booking: {
          select: {
            id: true,
            publicRef: true,
            productType: true,
            billingType: true,
            customer: { select: { name: true } },
          },
        },
        customer: { select: { id: true, name: true } },
        createdBy: { select: { name: true } },
      },
      orderBy: { paidAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.payment.count({ where }),
  ]);

  return { payments, total, page, limit, totalPages: Math.ceil(total / limit) };
}
