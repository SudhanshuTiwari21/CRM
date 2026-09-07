import { auth } from "@/lib/auth";
import {
  CASH_PAN_THRESHOLD,
  CASH_SALES_RATIO_MAX,
  CASH_TXN_MAX,
  assertCashBillingAllowed,
  getCashSalesTotals,
  getFinancialYearRange,
} from "@/lib/cash-compliance";
import { handleApiError, jsonOk, jsonError } from "@/lib/api-utils";

export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) return jsonError("Unauthorized", 401);

    const { searchParams } = new URL(request.url);
    const amount = parseFloat(searchParams.get("amount") || "0");

    const fy = getFinancialYearRange();
    const totals = await getCashSalesTotals({ from: fy.from, to: fy.to });
    const check = amount > 0 ? await assertCashBillingAllowed({ amount }) : { ok: true as const, totals, fyLabel: fy.label };

    return jsonOk({
      fyLabel: fy.label,
      cashSales: totals.cashSales,
      totalSales: totals.totalSales,
      cashSalesRatio: totals.ratioPercent,
      cashSalesRatioLimit: CASH_SALES_RATIO_MAX * 100,
      cashTxnMax: CASH_TXN_MAX,
      cashPanThreshold: CASH_PAN_THRESHOLD,
      cashBillingLocked: totals.ratio > CASH_SALES_RATIO_MAX,
      wouldExceed: check.ok === false,
      message: check.ok === false ? check.error : null,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
