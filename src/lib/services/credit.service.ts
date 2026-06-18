import { prisma } from "@/lib/db";
import type { CreditTransactionType } from "@prisma/client";

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

export async function getCustomerCreditSummary(customerId: string) {
  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
    select: {
      id: true,
      name: true,
      type: true,
      creditEnabled: true,
      creditLimit: true,
      creditBalance: true,
      paymentTermsDays: true,
    },
  });
  if (!customer) throw new Error("Customer not found");
  return customer;
}

export async function assertCreditAvailable(customerId: string, amount: number) {
  const customer = await getCustomerCreditSummary(customerId);
  if (!customer.creditEnabled) {
    throw new Error("Credit is not enabled for this customer");
  }
  const balance = Number(customer.creditBalance);
  const limit = customer.creditLimit != null ? Number(customer.creditLimit) : null;
  const newBalance = round2(balance + amount);
  if (limit != null && newBalance > limit) {
    throw new Error(
      `Credit limit exceeded. Limit: Rs. ${limit.toLocaleString("en-IN")}, outstanding: Rs. ${balance.toLocaleString("en-IN")}`
    );
  }
  return customer;
}

export async function recordCreditTransaction(params: {
  customerId: string;
  bookingId?: string;
  type: CreditTransactionType;
  amount: number;
  note?: string;
  createdById?: string;
}) {
  const customer = await prisma.customer.findUnique({ where: { id: params.customerId } });
  if (!customer) throw new Error("Customer not found");

  const delta =
    params.type === "DEBIT" ? params.amount : params.type === "CREDIT" || params.type === "REFUND" ? -params.amount : params.amount;

  const balanceAfter = round2(Number(customer.creditBalance) + delta);

  const [updated] = await prisma.$transaction([
    prisma.customer.update({
      where: { id: params.customerId },
      data: { creditBalance: balanceAfter },
    }),
    prisma.customerCreditTransaction.create({
      data: {
        customerId: params.customerId,
        bookingId: params.bookingId,
        type: params.type,
        amount: params.amount,
        balanceAfter,
        note: params.note,
        createdById: params.createdById,
      },
    }),
  ]);

  return updated;
}

export async function updateCustomerCreditSettings(
  customerId: string,
  data: {
    creditEnabled?: boolean;
    creditLimit?: number | null;
    paymentTermsDays?: number | null;
  }
) {
  return prisma.customer.update({
    where: { id: customerId },
    data: {
      creditEnabled: data.creditEnabled,
      creditLimit: data.creditLimit,
      paymentTermsDays: data.paymentTermsDays,
    },
  });
}

export async function listCreditTransactions(customerId: string) {
  return prisma.customerCreditTransaction.findMany({
    where: { customerId },
    orderBy: { createdAt: "desc" },
    include: {
      booking: { select: { publicRef: true, id: true } },
      createdBy: { select: { name: true } },
    },
  });
}
