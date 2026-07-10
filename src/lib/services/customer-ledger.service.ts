import { prisma } from "@/lib/db";
import type { Prisma } from "@prisma/client";
import { CASH_WALK_IN_PHONE } from "@/lib/cash-customer";
import {
  buildPaymentBookingTypeLines,
  buildSaleBookingTypeLines,
  formatLedgerVoucherNo,
} from "@/lib/ledger-voucher";

export interface CustomerLedgerRow {
  id: string;
  date: string;
  sortAt: string;
  bookingTypeLines: string[];
  voucherTypeLines: string[];
  voucherNo: string;
  debit: number | null;
  credit: number | null;
  closingBalance: number;
  balanceType: "Dr" | "Cr";
}

export interface CustomerLedgerReport {
  customer: {
    id: string;
    name: string;
    phone: string;
    gstin: string | null;
    address: string | null;
    city: string | null;
    state: string | null;
  };
  period: { from: string | null; to: string | null };
  openingBalance: number;
  openingBalanceType: "Dr" | "Cr";
  rows: CustomerLedgerRow[];
  totals: {
    debit: number;
    credit: number;
    closingBalance: number;
    balanceType: "Dr" | "Cr";
  };
}

type LedgerEntry = {
  id: string;
  sortAt: Date;
  bookingTypeLines: string[];
  voucherTypeLines: string[];
  voucherNo: string;
  debit: number;
  credit: number;
};

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

function balanceType(balance: number): "Dr" | "Cr" {
  return balance >= 0 ? "Dr" : "Cr";
}

function signedBalance(balance: number) {
  return Math.abs(round2(balance));
}

export async function getCustomerLedger(params: {
  customerId: string;
  from?: Date;
  to?: Date;
}): Promise<CustomerLedgerReport> {
  const customer = await prisma.customer.findUnique({
    where: { id: params.customerId },
    select: {
      id: true,
      name: true,
      phone: true,
      gstin: true,
      address: true,
      city: true,
      state: true,
    },
  });
  if (!customer) throw new Error("Customer not found");

  const bookings = await prisma.booking.findMany({
    where: {
      customerId: params.customerId,
      billingType: "LEDGER",
    },
    include: {
      flightBooking: true,
      hotelBooking: true,
      busBooking: true,
      payments: { where: { status: "PAID" }, orderBy: { paidAt: "asc" } },
    },
    orderBy: { createdAt: "asc" },
  });


  const [advancePayments, creditNotes] = await Promise.all([
    prisma.payment.findMany({
      where: {
        customerId: params.customerId,
        bookingId: null,
        status: "PAID",
      },
      orderBy: { paidAt: "asc" },
    }),
    prisma.creditNote.findMany({
      where: { customerId: params.customerId },
      include: {
        booking: { select: { publicRef: true, serialYear: true, serialNumber: true } },
      },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  const entries: LedgerEntry[] = [];

  for (const booking of bookings) {
    const voucherNo = formatLedgerVoucherNo(booking);
    const saleDate = booking.confirmedAt ?? booking.createdAt;

    entries.push({
      id: `sale-${booking.id}`,
      sortAt: saleDate,
      bookingTypeLines: buildSaleBookingTypeLines(
        booking.productType,
        booking.flightBooking,
        booking.hotelBooking,
        booking.busBooking
      ),
      voucherTypeLines: ["SALES", customer.name.toUpperCase()],
      voucherNo,
      debit: Number(booking.totalAmount),
      credit: 0,
    });

    for (const payment of booking.payments) {
      const againstVoucher = voucherNo;
      entries.push({
        id: `pay-${payment.id}`,
        sortAt: payment.paidAt,
        bookingTypeLines: buildPaymentBookingTypeLines(againstVoucher, false),
        voucherTypeLines: ["RECEIPT"],
        voucherNo: payment.referenceNumber || payment.gatewayRef || `RCT-${payment.id.slice(-6).toUpperCase()}`,
        debit: 0,
        credit: Number(payment.amount),
      });
    }
  }

  for (const payment of advancePayments) {
    entries.push({
      id: `adv-${payment.id}`,
      sortAt: payment.paidAt,
      bookingTypeLines: buildPaymentBookingTypeLines(null, true),
      voucherTypeLines: ["RECEIPT", "ADVANCE"],
      voucherNo:
        payment.referenceNumber ||
        payment.gatewayRef ||
        `ADV-${payment.id.slice(-6).toUpperCase()}`,
      debit: 0,
      credit: Number(payment.amount),
    });
  }

  for (const note of creditNotes) {
    const againstVoucher = note.booking ? formatLedgerVoucherNo(note.booking) : null;
    entries.push({
      id: `cn-${note.id}`,
      sortAt: note.createdAt,
      bookingTypeLines: againstVoucher
        ? ["CREDIT NOTE", againstVoucher]
        : ["CREDIT NOTE"],
      voucherTypeLines: ["CREDIT NOTE"],
      voucherNo: note.publicRef,
      debit: 0,
      credit: Number(note.amount),
    });
  }

  entries.sort((a, b) => a.sortAt.getTime() - b.sortAt.getTime());

  const fromMs = params.from?.getTime();
  const toMs = params.to?.getTime();

  let runningBalance = 0;
  const openingEntries: LedgerEntry[] = [];
  const periodEntries: LedgerEntry[] = [];

  for (const entry of entries) {
    const t = entry.sortAt.getTime();
    if (fromMs != null && t < fromMs) {
      openingEntries.push(entry);
    } else if (toMs != null && t > toMs) {
      continue;
    } else {
      periodEntries.push(entry);
    }
  }

  for (const entry of openingEntries) {
    runningBalance = round2(runningBalance + entry.debit - entry.credit);
  }

  const openingBalance = runningBalance;
  const rows: CustomerLedgerRow[] = [];

  if (fromMs != null && openingEntries.length > 0) {
    rows.push({
      id: "opening",
      date: params.from!.toISOString(),
      sortAt: params.from!.toISOString(),
      bookingTypeLines: ["OPENING BALANCE"],
      voucherTypeLines: [],
      voucherNo: "-",
      debit: null,
      credit: null,
      closingBalance: signedBalance(openingBalance),
      balanceType: balanceType(openingBalance),
    });
  }

  let totalDebit = 0;
  let totalCredit = 0;

  for (const entry of periodEntries) {
    runningBalance = round2(runningBalance + entry.debit - entry.credit);
    totalDebit = round2(totalDebit + entry.debit);
    totalCredit = round2(totalCredit + entry.credit);

    rows.push({
      id: entry.id,
      date: entry.sortAt.toISOString(),
      sortAt: entry.sortAt.toISOString(),
      bookingTypeLines: entry.bookingTypeLines,
      voucherTypeLines: entry.voucherTypeLines,
      voucherNo: entry.voucherNo,
      debit: entry.debit > 0 ? entry.debit : null,
      credit: entry.credit > 0 ? entry.credit : null,
      closingBalance: signedBalance(runningBalance),
      balanceType: balanceType(runningBalance),
    });
  }

  return {
    customer,
    period: {
      from: params.from?.toISOString() ?? null,
      to: params.to?.toISOString() ?? null,
    },
    openingBalance: signedBalance(openingBalance),
    openingBalanceType: balanceType(openingBalance),
    rows,
    totals: {
      debit: totalDebit,
      credit: totalCredit,
      closingBalance: signedBalance(runningBalance),
      balanceType: balanceType(runningBalance),
    },
  };
}

export async function listLedgerCustomers(search?: string) {
  const where: Prisma.CustomerWhereInput = {
    phone: { not: CASH_WALK_IN_PHONE },
    bookings: { some: { billingType: "LEDGER" } },
    ...(search?.trim()
      ? {
          OR: [
            { name: { contains: search, mode: "insensitive" } },
            { phone: { contains: search } },
            { gstin: { contains: search, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  return prisma.customer.findMany({
    where,
    select: { id: true, name: true, phone: true, gstin: true },
    orderBy: { name: "asc" },
    take: 100,
  });
}
