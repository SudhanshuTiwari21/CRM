"use client";

import Link from "next/link";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { CHANNEL_LABELS, PRODUCT_LABELS, BOOKING_STATUS_LABELS } from "@/lib/constants";
import type { BookingChannel, ProductType, BookingStatus } from "@prisma/client";
import { formatCurrency } from "@/lib/utils";
import { Plane, Building2, Bus, Radio } from "lucide-react";

const CHANNEL_COLORS: Record<string, string> = {
  LIVE_API: "#3b82f6",
  HELD: "#f59e0b",
  OFFLINE: "#8b5cf6",
};

const PRODUCT_COLORS: Record<string, string> = {
  FLIGHT: "#2563eb",
  HOTEL: "#059669",
  BUS: "#d97706",
};

const STATUS_COLORS: Record<string, string> = {
  PROCESSING: "#3b82f6",
  CONFIRMED: "#10b981",
  TICKET_SENT: "#059669",
  DRAFT: "#94a3b8",
  PENDING_PAYMENT: "#f59e0b",
  FAILED: "#ef4444",
  CANCELLED: "#64748b",
};

interface DashboardChartsProps {
  byChannel: { name: string; value: number }[];
  byProduct: { name: string; value: number }[];
  byStatus: { name: string; value: number }[];
  revenueByDay: { date: string; label: string; revenue: number; bookings: number }[];
  totalBookings: number;
}

function ChartCard({
  title,
  description,
  children,
  className,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`rounded-xl border bg-card p-5 shadow-sm ${className || ""}`}>
      <div className="mb-4">
        <h3 className="font-semibold tracking-tight">{title}</h3>
        {description && (
          <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
        )}
      </div>
      {children}
    </div>
  );
}

function CustomTooltip({
  active,
  payload,
  label,
  formatter,
}: {
  active?: boolean;
  payload?: { value: number; name?: string; payload?: { bookings?: number } }[];
  label?: string;
  formatter?: (v: number) => string;
}) {
  if (!active || !payload?.length) return null;
  const val = payload[0].value;
  return (
    <div className="rounded-lg border bg-popover px-3 py-2 text-sm shadow-lg">
      <p className="font-medium">{label}</p>
      <p className="text-primary">{formatter ? formatter(val) : val}</p>
      {payload[0].payload?.bookings !== undefined && (
        <p className="text-xs text-muted-foreground">
          {payload[0].payload.bookings} booking(s)
        </p>
      )}
    </div>
  );
}

export function DashboardCharts({
  byChannel,
  byProduct,
  byStatus,
  revenueByDay,
  totalBookings,
}: DashboardChartsProps) {
  const channelData = byChannel.map((c) => ({
    name: CHANNEL_LABELS[c.name as BookingChannel] || c.name,
    value: c.value,
    fill: CHANNEL_COLORS[c.name] || "#64748b",
    key: c.name,
  }));

  const productData = byProduct.map((p) => ({
    name: PRODUCT_LABELS[p.name as ProductType] || p.name,
    value: p.value,
    fill: PRODUCT_COLORS[p.name] || "#64748b",
    icon:
      p.name === "FLIGHT" ? Plane : p.name === "HOTEL" ? Building2 : Bus,
  }));

  const statusData = byStatus
    .map((s) => ({
      name: BOOKING_STATUS_LABELS[s.name as BookingStatus] || s.name,
      value: s.value,
      fill: STATUS_COLORS[s.name] || "#64748b",
      pct: totalBookings > 0 ? Math.round((s.value / totalBookings) * 100) : 0,
    }))
    .sort((a, b) => b.value - a.value);

  const weekTotal = revenueByDay.reduce((s, d) => s + d.revenue, 0);

  return (
    <div className="space-y-6">
      {/* Revenue trend - full width hero chart */}
      <ChartCard
        title="Revenue Overview"
        description="Last 7 days · paid bookings"
        className="col-span-full"
      >
        <div className="mb-4 flex items-end justify-between">
          <div>
            <p className="text-2xl font-bold tabular-nums">{formatCurrency(weekTotal)}</p>
            <p className="text-xs text-muted-foreground">This week</p>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={revenueByDay} margin={{ top: 5, right: 5, left: -10, bottom: 0 }}>
            <defs>
              <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.35} />
                <stop offset="100%" stopColor="#3b82f6" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" className="stroke-border" />
            <XAxis
              dataKey="label"
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
              tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`}
            />
            <Tooltip content={<CustomTooltip formatter={(v) => formatCurrency(v)} />} />
            <Area
              type="monotone"
              dataKey="revenue"
              stroke="#2563eb"
              strokeWidth={2.5}
              fill="url(#revenueGradient)"
              dot={{ fill: "#2563eb", strokeWidth: 0, r: 4 }}
              activeDot={{ r: 6, strokeWidth: 2, stroke: "#fff" }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </ChartCard>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Channel donut */}
        <ChartCard title="Booking Channels" description="Live · Held · Offline">
          {channelData.length === 0 ? (
            <EmptyChart message="No channel data yet" />
          ) : (
            <div className="flex flex-col items-center gap-4 sm:flex-row">
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie
                    data={channelData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={52}
                    outerRadius={72}
                    paddingAngle={3}
                    strokeWidth={0}
                  >
                    {channelData.map((entry, i) => (
                      <Cell key={i} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
              <div className="w-full space-y-2 sm:w-auto sm:min-w-[140px]">
                {channelData.map((c) => (
                  <div key={c.key} className="flex items-center justify-between gap-4 text-sm">
                    <div className="flex items-center gap-2">
                      <span
                        className="h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: c.fill }}
                      />
                      <span className="text-muted-foreground">{c.name}</span>
                    </div>
                    <span className="font-semibold tabular-nums">{c.value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </ChartCard>

        {/* Product mix bars */}
        <ChartCard title="Product Mix" description="Flights · Hotels · Buses">
          {productData.length === 0 ? (
            <EmptyChart message="No product data yet" />
          ) : (
            <div className="space-y-4">
              {productData.map((p) => {
                const Icon = p.icon;
                const max = Math.max(...productData.map((x) => x.value), 1);
                const width = (p.value / max) * 100;
                return (
                  <div key={p.name} className="space-y-1.5">
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <Icon className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">{p.name}</span>
                      </div>
                      <span className="font-bold tabular-nums">{p.value}</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{ width: `${width}%`, backgroundColor: p.fill }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </ChartCard>
      </div>

      {/* Status pipeline */}
      <ChartCard title="Booking Pipeline" description="Status breakdown across all bookings">
        {statusData.length === 0 ? (
          <EmptyChart message="No bookings yet" />
        ) : (
          <ResponsiveContainer width="100%" height={Math.max(160, statusData.length * 44)}>
            <BarChart data={statusData} layout="vertical" margin={{ left: 0, right: 16 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} className="stroke-border" />
              <XAxis type="number" hide />
              <YAxis
                type="category"
                dataKey="name"
                width={110}
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 12 }}
              />
              <Tooltip
                formatter={(value: number, _n, props) => [
                  `${value} (${props.payload.pct}%)`,
                  "Bookings",
                ]}
              />
              <Bar dataKey="value" radius={[0, 6, 6, 0]} barSize={22}>
                {statusData.map((entry, i) => (
                  <Cell key={i} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </ChartCard>
    </div>
  );
}

function EmptyChart({ message }: { message: string }) {
  return (
    <div className="flex h-[160px] flex-col items-center justify-center gap-2 text-muted-foreground">
      <Radio className="h-8 w-8 opacity-30" />
      <p className="text-sm">{message}</p>
    </div>
  );
}
