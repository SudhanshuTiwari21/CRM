import { prisma } from "@/lib/db";
import { getActiveDbBrand } from "@/lib/brand-context";
import type { CrmBrand } from "@prisma/client";

/** Hard max for a single cash bill (INR). */
export const CASH_TXN_MAX = 199_999;

/** Cash bills above this require PAN. */
export const CASH_PAN_THRESHOLD = 100_000;

/** Max cash share of total sales in the compliance window. */
export const CASH_SALES_RATIO_MAX = 0.3;

export type CashReportPeriod = "month" | "quarter" | "year" | "days";

const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;

export function isValidPan(pan?: string | null) {
  return Boolean(pan?.trim() && panRegex.test(pan.trim().toUpperCase()));
}

/** Indian FY starts 1 April. */
export function getFinancialYearRange(reference = new Date()) {
  const year = reference.getFullYear();
  const month = reference.getMonth(); // 0-based
  const fyStartYear = month >= 3 ? year : year - 1;
  const from = new Date(fyStartYear, 3, 1, 0, 0, 0, 0);
  const to = new Date(fyStartYear + 1, 2, 31, 23, 59, 59, 999);
  return { from, to, label: `FY ${fyStartYear}-${String(fyStartYear + 1).slice(-2)}` };
}

export function getReportPeriodRange(
  period: CashReportPeriod,
  options?: { year?: number; month?: number; quarter?: number; days?: number; reference?: Date }
) {
  const ref = options?.reference ?? new Date();

  if (period === "days") {
    const days = options?.days ?? 30;
    const to = new Date(ref);
    const from = new Date(ref);
    from.setDate(from.getDate() - days);
    from.setHours(0, 0, 0, 0);
    return { from, to, label: `Last ${days} days` };
  }

  if (period === "year") {
    if (options?.year) {
      const fyStartYear = options.year;
      const from = new Date(fyStartYear, 3, 1, 0, 0, 0, 0);
      const to = new Date(fyStartYear + 1, 2, 31, 23, 59, 59, 999);
      return { from, to, label: `FY ${fyStartYear}-${String(fyStartYear + 1).slice(-2)}` };
    }
    return getFinancialYearRange(ref);
  }

  if (period === "quarter") {
    const year = options?.year ?? ref.getFullYear();
    const quarter = options?.quarter ?? Math.floor(ref.getMonth() / 3) + 1;
    const startMonth = (quarter - 1) * 3;
    const from = new Date(year, startMonth, 1, 0, 0, 0, 0);
    const to = new Date(year, startMonth + 3, 0, 23, 59, 59, 999);
    return { from, to, label: `Q${quarter} ${year}` };
  }

  // month
  const year = options?.year ?? ref.getFullYear();
  const month = options?.month ?? ref.getMonth() + 1; // 1-12
  const from = new Date(year, month - 1, 1, 0, 0, 0, 0);
  const to = new Date(year, month, 0, 23, 59, 59, 999);
  const label = from.toLocaleString("en-IN", { month: "long", year: "numeric" });
  return { from, to, label };
}

export function validateCashBillAmountAndPan(input: {
  billingType: "CASH" | "LEDGER";
  totalAmount: number;
  pan?: string | null;
}): string | null {
  if (input.billingType !== "CASH") return null;
  const amount = Number(input.totalAmount) || 0;

  if (amount > CASH_TXN_MAX) {
    return `Cash billing is not allowed above ₹${CASH_TXN_MAX.toLocaleString("en-IN")}. Use ledger billing instead.`;
  }

  if (amount > CASH_PAN_THRESHOLD && !isValidPan(input.pan)) {
    return `PAN is mandatory for cash bills above ₹${CASH_PAN_THRESHOLD.toLocaleString("en-IN")}.`;
  }

  return null;
}

export async function getCashSalesTotals(params: {
  from: Date;
  to: Date;
  brandId?: CrmBrand;
  excludeBookingId?: string;
}) {
  const brandId = params.brandId ?? (await getActiveDbBrand());
  const bookings = await prisma.booking.findMany({
    where: {
      brandId,
      createdAt: { gte: params.from, lte: params.to },
      status: { not: "CANCELLED" },
      ...(params.excludeBookingId ? { id: { not: params.excludeBookingId } } : {}),
    },
    select: {
      billingType: true,
      totalAmount: true,
      paymentStatus: true,
    },
  });

  let cashSales = 0;
  let totalSales = 0;
  let cashCount = 0;
  let totalCount = 0;

  for (const b of bookings) {
    const amount = Number(b.totalAmount) || 0;
    totalSales += amount;
    totalCount += 1;
    if (b.billingType === "CASH") {
      cashSales += amount;
      cashCount += 1;
    }
  }

  const ratio = totalSales > 0 ? cashSales / totalSales : 0;

  return {
    cashSales,
    totalSales,
    ledgerSales: totalSales - cashSales,
    cashCount,
    totalCount,
    ratio,
    ratioPercent: Math.round(ratio * 1000) / 10,
  };
}

/**
 * Returns an error message if adding this cash bill would exceed the 30% cash-sales cap
 * for the current financial year.
 */
export async function assertCashBillingAllowed(params: {
  amount: number;
  brandId?: CrmBrand;
}): Promise<{ ok: true; totals: Awaited<ReturnType<typeof getCashSalesTotals>>; fyLabel: string } | { ok: false; error: string }> {
  const { from, to, label } = getFinancialYearRange();
  const totals = await getCashSalesTotals({ from, to, brandId: params.brandId });
  const projectedCash = totals.cashSales + params.amount;
  const projectedTotal = totals.totalSales + params.amount;
  const projectedRatio = projectedTotal > 0 ? projectedCash / projectedTotal : 0;

  if (projectedRatio > CASH_SALES_RATIO_MAX + 1e-9) {
    const currentPct = totals.ratioPercent;
    const projectedPct = Math.round(projectedRatio * 1000) / 10;
    return {
      ok: false,
      error: `Cash billing is locked for ${label}. Cash sales are already ${currentPct}% of total sales (limit ${CASH_SALES_RATIO_MAX * 100}%). Adding this bill would make it ${projectedPct}%. Use ledger billing instead.`,
    };
  }

  return { ok: true, totals, fyLabel: label };
}
