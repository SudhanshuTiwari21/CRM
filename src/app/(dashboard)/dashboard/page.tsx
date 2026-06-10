import { auth } from "@/lib/auth";
import { getDashboardStats } from "@/lib/services/booking.service";
import { formatCurrency } from "@/lib/utils";
import { DashboardHero } from "@/components/dashboard/dashboard-hero";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { DashboardCharts } from "@/components/dashboard/dashboard-charts";
import { ProcessingQueuePanel } from "@/components/dashboard/processing-queue-panel";
import { RecentBookingsPanel } from "@/components/dashboard/recent-bookings-panel";
import { ActivityFeed } from "@/components/dashboard/activity-feed";
import { CommandPalette } from "@/components/command-palette";
import {
  Calendar,
  Clock,
  AlertCircle,
  IndianRupee,
  Ticket,
  Layers,
} from "lucide-react";

export default async function DashboardPage() {
  const [session, stats] = await Promise.all([auth(), getDashboardStats()]);

  const bookingTrend =
    stats.yesterdayBookings === 0
      ? stats.todayBookings > 0
        ? { value: 1, label: "New today" }
        : undefined
      : {
          value: stats.todayBookings - stats.yesterdayBookings,
          label: `${stats.todayBookings >= stats.yesterdayBookings ? "+" : ""}${
            stats.todayBookings - stats.yesterdayBookings
          } vs yesterday`,
        };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-end sm:hidden">
        <CommandPalette />
      </div>

      <DashboardHero
        userName={session?.user?.name}
        processingCount={stats.processingCount}
        pendingPnr={stats.pendingPnr}
      />

      {/* KPI grid */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        <KpiCard
          title="Today's Bookings"
          value={stats.todayBookings}
          icon={Calendar}
          accent="blue"
          trend={bookingTrend}
        />
        <KpiCard
          title="Processing Queue"
          value={stats.processingCount}
          icon={Clock}
          accent="amber"
          subtitle="Needs agent action"
          highlight={stats.processingCount > 0}
        />
        <KpiCard
          title="Pending PNR"
          value={stats.pendingPnr}
          icon={AlertCircle}
          accent="rose"
          subtitle="Manual confirmation"
          highlight={stats.pendingPnr > 0}
        />
        <KpiCard
          title="Total Revenue"
          value={formatCurrency(stats.totalRevenue)}
          icon={IndianRupee}
          accent="emerald"
          subtitle="All paid bookings"
        />
        <KpiCard
          title="This Week"
          value={formatCurrency(stats.weekRevenue)}
          icon={Layers}
          accent="violet"
          subtitle="Last 7 days revenue"
        />
        <KpiCard
          title="Tickets Sent"
          value={stats.ticketSentCount + stats.confirmedCount}
          icon={Ticket}
          accent="cyan"
          subtitle={`${stats.totalBookings} total bookings`}
        />
      </div>

      {/* Charts + queue */}
      <div className="grid gap-6 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <DashboardCharts
            byChannel={stats.byChannel}
            byProduct={stats.byProduct}
            byStatus={stats.byStatus}
            revenueByDay={stats.revenueByDay}
            totalBookings={stats.totalBookings}
          />
        </div>
        <ProcessingQueuePanel items={stats.processingQueue} total={stats.processingCount} />
      </div>

      {/* Recent + activity */}
      <div className="grid gap-6 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <RecentBookingsPanel bookings={stats.recentBookings} />
        </div>
        <div className="lg:col-span-2">
          <ActivityFeed items={stats.recentActivity} />
        </div>
      </div>
    </div>
  );
}
