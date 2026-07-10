import { prisma } from "@/lib/db";
import { parseCashCustomerSnapshot, CASH_WALK_IN_PHONE } from "@/lib/cash-customer";
import {
  computeAmountDue,
  OPEN_PAYMENT_STATUSES,
  sumPaidPayments,
} from "@/lib/payment-utils";

export interface PendingPaymentRecord {
  id: string;
  amount: number;
  method: string;
  status: string;
  paidAt: string;
  gatewayRef: string | null;
}

export interface PendingBookingRow {
  id: string;
  publicRef: string;
  productType: string;
  billingType: string;
  paymentStatus: string;
  totalAmount: number;
  paidAmount: number;
  amountDue: number;
  createdAt: string;
  pnr: string | null;
  customerId: string;
  customerName: string;
  customerPhone: string;
  payments: PendingPaymentRecord[];
}

export interface LedgerCustomerDue {
  customerId: string;
  customerName: string;
  customerPhone: string;
  creditEnabled: boolean;
  creditBalance: number;
  creditLimit: number | null;
  bookings: PendingBookingRow[];
  totalDue: number;
  totalPaid: number;
}

export interface PendingPaymentsReport {
  ledger: {
    summary: { customers: number; bookings: number; totalDue: number; totalPaid: number };
    customers: LedgerCustomerDue[];
  };
  cash: {
    summary: { bookings: number; totalDue: number; totalPaid: number };
    bookings: PendingBookingRow[];
  };
  all: PendingBookingRow[];
}

function toPendingRow(
  b: Awaited<ReturnType<typeof fetchOpenBookings>>[number],
  customerName: string,
  customerPhone: string
): PendingBookingRow | null {
  const totalAmount = Number(b.totalAmount);
  const paidAmount = sumPaidPayments(b.payments);
  const amountDue = computeAmountDue(totalAmount, paidAmount);
  if (amountDue <= 0) return null;

  return {
    id: b.id,
    publicRef: b.publicRef,
    productType: b.productType,
    billingType: b.billingType,
    paymentStatus: b.paymentStatus,
    totalAmount,
    paidAmount,
    amountDue,
    createdAt: b.createdAt.toISOString(),
    pnr: b.pnr,
    customerId: b.customerId,
    customerName,
    customerPhone,
    payments: b.payments
      .filter((p) => p.status === "PAID")
      .map((p) => ({
        id: p.id,
        amount: Number(p.amount),
        method: p.method,
        status: p.status,
        paidAt: p.paidAt.toISOString(),
        gatewayRef: p.gatewayRef,
      })),
  };
}

async function fetchOpenBookings() {
  return prisma.booking.findMany({
    where: {
      status: { not: "CANCELLED" },
      paymentStatus: { in: OPEN_PAYMENT_STATUSES },
    },
    include: {
      customer: true,
      payments: { orderBy: { paidAt: "desc" } },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function getPendingPayments(): Promise<PendingPaymentsReport> {
  const bookings = await fetchOpenBookings();

  const ledgerBookings = bookings.filter((b) => b.billingType === "LEDGER");
  const cashBookings = bookings.filter((b) => b.billingType === "CASH");

  const ledgerByCustomer = new Map<string, LedgerCustomerDue>();
  const allRows: PendingBookingRow[] = [];

  for (const b of ledgerBookings) {
    if (b.customer.phone === CASH_WALK_IN_PHONE) continue;

    const row = toPendingRow(b, b.customer.name, b.customer.phone);
    if (!row) continue;

    allRows.push(row);

    const existing = ledgerByCustomer.get(b.customerId);
    if (existing) {
      existing.bookings.push(row);
      existing.totalDue += row.amountDue;
      existing.totalPaid += row.paidAmount;
    } else {
      ledgerByCustomer.set(b.customerId, {
        customerId: b.customerId,
        customerName: b.customer.name,
        customerPhone: b.customer.phone,
        creditEnabled: b.customer.creditEnabled,
        creditBalance: Number(b.customer.creditBalance),
        creditLimit: b.customer.creditLimit != null ? Number(b.customer.creditLimit) : null,
        bookings: [row],
        totalDue: row.amountDue,
        totalPaid: row.paidAmount,
      });
    }
  }

  const ledgerCustomers = [...ledgerByCustomer.values()].sort((a, b) => b.totalDue - a.totalDue);

  const cashRows: PendingBookingRow[] = [];
  for (const b of cashBookings) {
    const snap = parseCashCustomerSnapshot(b.metadata);
    const row = toPendingRow(b, snap?.name || "Walk-in", snap?.phone || "-");
    if (!row) continue;
    cashRows.push(row);
    allRows.push(row);
  }

  allRows.sort((a, b) => b.amountDue - a.amountDue);

  return {
    ledger: {
      summary: {
        customers: ledgerCustomers.length,
        bookings: ledgerCustomers.reduce((s, c) => s + c.bookings.length, 0),
        totalDue: ledgerCustomers.reduce((s, c) => s + c.totalDue, 0),
        totalPaid: ledgerCustomers.reduce((s, c) => s + c.totalPaid, 0),
      },
      customers: ledgerCustomers,
    },
    cash: {
      summary: {
        bookings: cashRows.length,
        totalDue: cashRows.reduce((s, r) => s + r.amountDue, 0),
        totalPaid: cashRows.reduce((s, r) => s + r.paidAmount, 0),
      },
      bookings: cashRows,
    },
    all: allRows,
  };
}
