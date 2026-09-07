import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getActiveDbBrand } from "@/lib/brand-context";
import { parseCashCustomerSnapshot } from "@/lib/cash-customer";
import {
  CASH_SALES_RATIO_MAX,
  getCashSalesTotals,
  getFinancialYearRange,
  getReportPeriodRange,
  type CashReportPeriod,
} from "@/lib/cash-compliance";
import { handleApiError, jsonOk, jsonError } from "@/lib/api-utils";

export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) return jsonError("Unauthorized", 401);

    const { searchParams } = new URL(request.url);
    const periodParam = (searchParams.get("period") || "month") as CashReportPeriod;
    const period: CashReportPeriod =
      periodParam === "quarter" || periodParam === "year" || periodParam === "days" || periodParam === "month"
        ? periodParam
        : "month";

    const year = searchParams.get("year") ? parseInt(searchParams.get("year")!, 10) : undefined;
    const month = searchParams.get("month") ? parseInt(searchParams.get("month")!, 10) : undefined;
    const quarter = searchParams.get("quarter") ? parseInt(searchParams.get("quarter")!, 10) : undefined;
    const days = searchParams.get("days") ? parseInt(searchParams.get("days")!, 10) : 30;

    const range = getReportPeriodRange(period, { year, month, quarter, days });
    const brandId = await getActiveDbBrand();

    const bookings = await prisma.booking.findMany({
      where: {
        brandId,
        createdAt: { gte: range.from, lte: range.to },
        status: { not: "CANCELLED" },
      },
      include: {
        customer: true,
        assignedAgent: { select: { name: true } },
        activityLogs: {
          where: { action: "PNR_CONFIRMED" },
          select: { createdAt: true },
          take: 1,
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const cashBookings = bookings
      .filter((b) => b.billingType === "CASH")
      .map((b) => {
        const snap = parseCashCustomerSnapshot(b.metadata);
        return {
          id: b.id,
          publicRef: b.publicRef,
          productType: b.productType,
          totalAmount: Number(b.totalAmount),
          paymentStatus: b.paymentStatus,
          createdAt: b.createdAt.toISOString(),
          customerName: snap?.name || "Walk-in",
          customerPhone: snap?.phone || "-",
        };
      });

    const revenueByDay: Record<string, number> = {};
    const agentStats: Record<string, { name: string; count: number; revenue: number }> = {};
    let totalSlaHours = 0;
    let slaCount = 0;

    for (const b of bookings) {
      const day = b.createdAt.toISOString().split("T")[0];
      revenueByDay[day] = (revenueByDay[day] || 0) + Number(b.totalAmount);

      const agentName = b.assignedAgent?.name || "Unassigned";
      if (!agentStats[agentName]) {
        agentStats[agentName] = { name: agentName, count: 0, revenue: 0 };
      }
      agentStats[agentName].count++;
      agentStats[agentName].revenue += Number(b.totalAmount);

      const confirmed = b.activityLogs[0];
      if (confirmed) {
        const hours = (confirmed.createdAt.getTime() - b.createdAt.getTime()) / (1000 * 60 * 60);
        totalSlaHours += hours;
        slaCount++;
      }
    }

    const channelMix = await prisma.booking.groupBy({
      by: ["channel"],
      where: {
        brandId,
        createdAt: { gte: range.from, lte: range.to },
        status: { not: "CANCELLED" },
      },
      _count: true,
      _sum: { totalAmount: true },
    });

    const periodTotals = await getCashSalesTotals({
      from: range.from,
      to: range.to,
      brandId,
    });

    const fy = getFinancialYearRange();
    const fyTotals = await getCashSalesTotals({ from: fy.from, to: fy.to, brandId });
    const cashBillingLocked = fyTotals.ratio > CASH_SALES_RATIO_MAX;

    return jsonOk({
      period,
      periodLabel: range.label,
      periodFrom: range.from.toISOString(),
      periodTo: range.to.toISOString(),
      revenueByDay: Object.entries(revenueByDay)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, revenue]) => ({ date, revenue })),
      agentPerformance: Object.values(agentStats),
      channelMix: channelMix.map((c) => ({
        channel: c.channel,
        count: c._count,
        revenue: Number(c._sum.totalAmount || 0),
      })),
      cashBookings,
      cashRevenue: periodTotals.cashSales,
      ledgerRevenue: periodTotals.ledgerSales,
      cashSalesRatio: periodTotals.ratioPercent,
      cashSalesRatioLimit: CASH_SALES_RATIO_MAX * 100,
      cashBillingLocked,
      fyLabel: fy.label,
      fyCashSales: fyTotals.cashSales,
      fyTotalSales: fyTotals.totalSales,
      fyCashSalesRatio: fyTotals.ratioPercent,
      avgProcessingHours: slaCount > 0 ? Math.round(totalSlaHours / slaCount) : 0,
      totalBookings: bookings.length,
      totalRevenue: periodTotals.totalSales,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
