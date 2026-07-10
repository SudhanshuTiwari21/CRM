import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { parseCashCustomerSnapshot } from "@/lib/cash-customer";
import { handleApiError, jsonOk, jsonError } from "@/lib/api-utils";

export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) return jsonError("Unauthorized", 401);

    const { searchParams } = new URL(request.url);
    const days = parseInt(searchParams.get("days") || "30", 10);
    const since = new Date();
    since.setDate(since.getDate() - days);

    const bookings = await prisma.booking.findMany({
      where: { createdAt: { gte: since } },
      include: {
        customer: true,
        assignedAgent: { select: { name: true } },
        activityLogs: {
          where: { action: "PNR_CONFIRMED" },
          select: { createdAt: true },
          take: 1,
        },
      },
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
      if (b.paymentStatus === "PAID") {
        revenueByDay[day] = (revenueByDay[day] || 0) + Number(b.totalAmount);
      }

      const agentName = b.assignedAgent?.name || "Unassigned";
      if (!agentStats[agentName]) {
        agentStats[agentName] = { name: agentName, count: 0, revenue: 0 };
      }
      agentStats[agentName].count++;
      if (b.paymentStatus === "PAID") {
        agentStats[agentName].revenue += Number(b.totalAmount);
      }

      const confirmed = b.activityLogs[0];
      if (confirmed) {
        const hours = (confirmed.createdAt.getTime() - b.createdAt.getTime()) / (1000 * 60 * 60);
        totalSlaHours += hours;
        slaCount++;
      }
    }

    const channelMix = await prisma.booking.groupBy({
      by: ["channel"],
      where: { createdAt: { gte: since } },
      _count: true,
      _sum: { totalAmount: true },
    });

    return jsonOk({
      revenueByDay: Object.entries(revenueByDay).map(([date, revenue]) => ({ date, revenue })),
      agentPerformance: Object.values(agentStats),
      channelMix: channelMix.map((c) => ({
        channel: c.channel,
        count: c._count,
        revenue: Number(c._sum.totalAmount || 0),
      })),
      cashBookings,
      cashRevenue: cashBookings
        .filter((b) => b.paymentStatus === "PAID")
        .reduce((s, b) => s + b.totalAmount, 0),
      ledgerRevenue: bookings
        .filter((b) => b.billingType === "LEDGER" && b.paymentStatus === "PAID")
        .reduce((s, b) => s + Number(b.totalAmount), 0),
      avgProcessingHours: slaCount > 0 ? Math.round(totalSlaHours / slaCount) : 0,
      totalBookings: bookings.length,
      totalRevenue: bookings
        .filter((b) => b.paymentStatus === "PAID")
        .reduce((s, b) => s + Number(b.totalAmount), 0),
    });
  } catch (error) {
    return handleApiError(error);
  }
}
