import { prisma } from "@/lib/db";
import type { Prisma } from "@prisma/client";
import { CASH_WALK_IN_PHONE } from "@/lib/cash-customer";
import { getActiveDbBrand } from "@/lib/brand-context";
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
    branchId: string | null;
    branchName: string | null;
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

export type LedgerAccountOption = {
  /** Selection key: customerId or customerId::branchId */
  id: string;
  customerId: string;
  branchId: string | null;
  name: string;
  phone: string;
  gstin: string | null;
  branchName: string | null;
};

type LedgerEntry = {
  id: string;
  sortAt: Date;
  bookingTypeLines: string[];
  voucherTypeLines: string[];
  voucherNo: string;
  debit: number;
  credit: number;
};

type BranchRow = {
  id: string;
  name: string;
  gstin: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  pincode: string | null;
  isPrimary: boolean;
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

function normalizeGstin(value?: string | null) {
  const gstin = value?.trim().toUpperCase() || "";
  return gstin || null;
}

function bookingBuyerGstin(booking: {
  flightBooking?: { buyerGstin?: string | null } | null;
  hotelBooking?: { buyerGstin?: string | null } | null;
}) {
  return (
    normalizeGstin(booking.flightBooking?.buyerGstin) ||
    normalizeGstin(booking.hotelBooking?.buyerGstin)
  );
}

function parseLedgerSelection(selectionId: string) {
  const [customerId, branchId] = selectionId.split("::");
  return {
    customerId,
    branchId: branchId || null,
  };
}

function accountSelectionId(customerId: string, branchId?: string | null) {
  return branchId ? `${customerId}::${branchId}` : customerId;
}

function displayAccountName(customerName: string, branch: BranchRow | null) {
  if (!branch) return customerName;
  const gstin = normalizeGstin(branch.gstin);
  return gstin ? `${customerName} — ${branch.name} (${gstin})` : `${customerName} — ${branch.name}`;
}

function resolveBranchForBooking(
  branches: BranchRow[],
  buyerGstin: string | null
): BranchRow | null {
  if (branches.length === 0) return null;
  if (branches.length === 1) return branches[0];

  if (buyerGstin) {
    const byGstin = branches.find((b) => normalizeGstin(b.gstin) === buyerGstin);
    if (byGstin) return byGstin;
  }

  const primary = branches.find((b) => b.isPrimary) || branches[0];
  // Bookings without GSTIN (or unknown GSTIN) fall under primary
  if (!buyerGstin) return primary;
  return primary;
}

export async function getCustomerLedger(params: {
  customerId: string;
  branchId?: string | null;
  from?: Date;
  to?: Date;
}): Promise<CustomerLedgerReport> {
  const brandId = await getActiveDbBrand();
  const customer = await prisma.customer.findFirst({
    where: { id: params.customerId, brandId },
    select: {
      id: true,
      name: true,
      phone: true,
      gstin: true,
      address: true,
      city: true,
      state: true,
      branches: {
        orderBy: [{ isPrimary: "desc" }, { name: "asc" }],
      },
    },
  });
  if (!customer) throw new Error("Customer not found");

  const branches = customer.branches as BranchRow[];
  const selectedBranch =
    (params.branchId
      ? branches.find((b) => b.id === params.branchId)
      : null) ||
    (branches.length === 1 ? branches[0] : null) ||
    (branches.length > 1 ? branches.find((b) => b.isPrimary) || branches[0] : null);

  if (params.branchId && !selectedBranch) {
    throw new Error("Branch not found for this customer");
  }

  const filterByBranch = Boolean(params.branchId && selectedBranch && branches.length > 1);

  const allBookings = await prisma.booking.findMany({
    where: {
      brandId,
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

  const bookings = filterByBranch
    ? allBookings.filter((booking) => {
        const matched = resolveBranchForBooking(branches, bookingBuyerGstin(booking));
        return matched?.id === selectedBranch!.id;
      })
    : allBookings;

  const bookingIds = new Set(bookings.map((b) => b.id));

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
        booking: {
          select: {
            id: true,
            publicRef: true,
            serialYear: true,
            serialNumber: true,
            flightBooking: { select: { buyerGstin: true } },
            hotelBooking: { select: { buyerGstin: true } },
          },
        },
      },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  const accountLabel = selectedBranch
    ? displayAccountName(customer.name, selectedBranch)
    : customer.name;

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
      voucherTypeLines: ["SALES", accountLabel.toUpperCase()],
      voucherNo,
      debit: Number(booking.totalAmount),
      credit: 0,
    });

    for (const payment of booking.payments) {
      entries.push({
        id: `pay-${payment.id}`,
        sortAt: payment.paidAt,
        bookingTypeLines: buildPaymentBookingTypeLines(voucherNo, false),
        voucherTypeLines: ["RECEIPT"],
        voucherNo:
          payment.referenceNumber ||
          payment.gatewayRef ||
          `RCT-${payment.id.slice(-6).toUpperCase()}`,
        debit: 0,
        credit: Number(payment.amount),
      });
    }
  }

  // Advances / unlinked credit notes sit on the primary (or sole) branch ledger
  const primaryBranch = branches.find((b) => b.isPrimary) || branches[0] || null;
  const includeUnassigned =
    !filterByBranch ||
    !selectedBranch ||
    !primaryBranch ||
    selectedBranch.id === primaryBranch.id;

  if (includeUnassigned) {
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
  }

  for (const note of creditNotes) {
    if (filterByBranch) {
      if (note.bookingId) {
        if (!bookingIds.has(note.bookingId)) {
          // Booking may have been filtered out — resolve by GSTIN on linked booking
          if (!note.booking) continue;
          const matched = resolveBranchForBooking(branches, bookingBuyerGstin(note.booking));
          if (matched?.id !== selectedBranch!.id) continue;
        }
      } else if (!includeUnassigned) {
        continue;
      }
    }

    const againstVoucher = note.booking ? formatLedgerVoucherNo(note.booking) : null;
    entries.push({
      id: `cn-${note.id}`,
      sortAt: note.createdAt,
      bookingTypeLines: againstVoucher ? ["CREDIT NOTE", againstVoucher] : ["CREDIT NOTE"],
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
    customer: {
      id: customer.id,
      name: accountLabel,
      phone: customer.phone,
      gstin: normalizeGstin(selectedBranch?.gstin) || normalizeGstin(customer.gstin),
      address: selectedBranch?.address || customer.address,
      city: selectedBranch?.city || customer.city,
      state: selectedBranch?.state || customer.state,
      branchId: selectedBranch?.id || null,
      branchName: selectedBranch?.name || null,
    },
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

export async function listLedgerCustomers(search?: string): Promise<LedgerAccountOption[]> {
  const brandId = await getActiveDbBrand();
  const where: Prisma.CustomerWhereInput = {
    brandId,
    phone: { not: CASH_WALK_IN_PHONE },
    bookings: { some: { brandId, billingType: "LEDGER" } },
    ...(search?.trim()
      ? {
          OR: [
            { name: { contains: search, mode: "insensitive" } },
            { phone: { contains: search } },
            { gstin: { contains: search, mode: "insensitive" } },
            { branches: { some: { gstin: { contains: search, mode: "insensitive" } } } },
            { branches: { some: { name: { contains: search, mode: "insensitive" } } } },
          ],
        }
      : {}),
  };

  const customers = await prisma.customer.findMany({
    where,
    select: {
      id: true,
      name: true,
      phone: true,
      gstin: true,
      branches: {
        orderBy: [{ isPrimary: "desc" }, { name: "asc" }],
        select: {
          id: true,
          name: true,
          gstin: true,
          isPrimary: true,
        },
      },
    },
    orderBy: { name: "asc" },
    take: 100,
  });

  const accounts: LedgerAccountOption[] = [];

  for (const customer of customers) {
    if (customer.branches.length > 1) {
      for (const branch of customer.branches) {
        accounts.push({
          id: accountSelectionId(customer.id, branch.id),
          customerId: customer.id,
          branchId: branch.id,
          name: displayAccountName(customer.name, branch as BranchRow),
          phone: customer.phone,
          gstin: normalizeGstin(branch.gstin) || normalizeGstin(customer.gstin),
          branchName: branch.name,
        });
      }
    } else {
      const branch = customer.branches[0] || null;
      accounts.push({
        id: accountSelectionId(customer.id, branch?.id),
        customerId: customer.id,
        branchId: branch?.id || null,
        name: branch ? displayAccountName(customer.name, branch as BranchRow) : customer.name,
        phone: customer.phone,
        gstin: normalizeGstin(branch?.gstin) || normalizeGstin(customer.gstin),
        branchName: branch?.name || null,
      });
    }
  }

  return accounts;
}

export function resolveLedgerSelection(selectionId: string) {
  return parseLedgerSelection(selectionId);
}
