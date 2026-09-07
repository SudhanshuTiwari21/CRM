"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { CHANNEL_LABELS, PRODUCT_LABELS } from "@/lib/constants";
import type { BookingChannel, ProductType } from "@prisma/client";
import { AlertTriangle } from "lucide-react";

interface ReportData {
  period: string;
  periodLabel: string;
  revenueByDay: { date: string; revenue: number }[];
  agentPerformance: { name: string; count: number; revenue: number }[];
  channelMix: { channel: string; count: number; revenue: number }[];
  cashBookings: {
    id: string;
    publicRef: string;
    productType: string;
    totalAmount: number;
    paymentStatus: string;
    createdAt: string;
    customerName: string;
    customerPhone: string;
  }[];
  cashRevenue: number;
  ledgerRevenue: number;
  cashSalesRatio: number;
  cashSalesRatioLimit: number;
  cashBillingLocked: boolean;
  fyLabel: string;
  fyCashSales: number;
  fyTotalSales: number;
  fyCashSalesRatio: number;
  avgProcessingHours: number;
  totalBookings: number;
  totalRevenue: number;
}

type Period = "month" | "quarter" | "year";

export function ReportsDashboard() {
  const now = useMemo(() => new Date(), []);
  const [period, setPeriod] = useState<Period>("month");
  const [year, setYear] = useState(String(now.getFullYear()));
  const [month, setMonth] = useState(String(now.getMonth() + 1));
  const [quarter, setQuarter] = useState(String(Math.floor(now.getMonth() / 3) + 1));
  const [data, setData] = useState<ReportData | null>(null);

  useEffect(() => {
    const params = new URLSearchParams({ period, year });
    if (period === "month") params.set("month", month);
    if (period === "quarter") params.set("quarter", quarter);

    fetch(`/api/crm/reports?${params}`)
      .then((r) => r.json())
      .then(setData)
      .catch(() => setData(null));
  }, [period, year, month, quarter]);

  if (!data) return <div className="py-8 text-center text-muted-foreground">Loading reports...</div>;

  const channelData = data.channelMix.map((c) => ({
    name: CHANNEL_LABELS[c.channel as BookingChannel] || c.channel,
    count: c.count,
    revenue: c.revenue,
  }));

  const ratioOverLimit = data.cashSalesRatio > data.cashSalesRatioLimit;
  const years = [now.getFullYear(), now.getFullYear() - 1, now.getFullYear() - 2];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-end gap-2">
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">Period</p>
          <Select value={period} onValueChange={(v) => setPeriod(v as Period)}>
            <SelectTrigger className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="month">Monthly</SelectItem>
              <SelectItem value="quarter">Quarterly</SelectItem>
              <SelectItem value="year">Yearly (FY)</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {period === "month" && (
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Month</p>
            <Select value={month} onValueChange={setMonth}>
              <SelectTrigger className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Array.from({ length: 12 }, (_, i) => (
                  <SelectItem key={i + 1} value={String(i + 1)}>
                    {new Date(2000, i, 1).toLocaleString("en-IN", { month: "long" })}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        {period === "quarter" && (
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Quarter</p>
            <Select value={quarter} onValueChange={setQuarter}>
              <SelectTrigger className="w-28">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">Q1</SelectItem>
                <SelectItem value="2">Q2</SelectItem>
                <SelectItem value="3">Q3</SelectItem>
                <SelectItem value="4">Q4</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">Year</p>
          <Select value={year} onValueChange={setYear}>
            <SelectTrigger className="w-28">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {years.map((y) => (
                <SelectItem key={y} value={String(y)}>
                  {y}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <p className="text-sm text-muted-foreground">Showing: {data.periodLabel}</p>

      {data.cashBillingLocked && (
        <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-900">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p className="font-semibold">Cash billing locked for {data.fyLabel}</p>
            <p className="mt-1 text-red-800">
              Cash sales are {data.fyCashSalesRatio}% of total sales (limit {data.cashSalesRatioLimit}%).
              New cash bills are blocked until the ratio drops below the limit. Use ledger billing instead.
            </p>
          </div>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Total Bookings</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{data.totalBookings}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Total Sales</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{formatCurrency(data.totalRevenue)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Cash Sales</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{formatCurrency(data.cashRevenue)}</p>
            <p className="text-xs text-muted-foreground">{data.cashBookings.length} cash bills</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Ledger Sales</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{formatCurrency(data.ledgerRevenue)}</p>
          </CardContent>
        </Card>
        <Card className={ratioOverLimit ? "border-red-300 bg-red-50/50" : ""}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Cash Sales Ratio</CardTitle>
          </CardHeader>
          <CardContent>
            <p className={`text-2xl font-bold ${ratioOverLimit ? "text-red-700" : ""}`}>
              {data.cashSalesRatio}%
            </p>
            <p className="text-xs text-muted-foreground">Limit {data.cashSalesRatioLimit}%</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">FY compliance ({data.fyLabel})</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-3 text-sm">
          <div>
            <p className="text-muted-foreground">FY cash sales</p>
            <p className="font-semibold">{formatCurrency(data.fyCashSales)}</p>
          </div>
          <div>
            <p className="text-muted-foreground">FY total sales</p>
            <p className="font-semibold">{formatCurrency(data.fyTotalSales)}</p>
          </div>
          <div>
            <p className="text-muted-foreground">FY cash ratio</p>
            <p className={`font-semibold ${data.cashBillingLocked ? "text-red-700" : ""}`}>
              {data.fyCashSalesRatio}% / {data.cashSalesRatioLimit}%
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Sales Trend</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={data.revenueByDay}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip formatter={(v: number) => formatCurrency(v)} />
                <Bar dataKey="revenue" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Channel Mix</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={channelData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip />
                <Bar dataKey="count" fill="#10b981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Cash Sales (walk-in bills)</CardTitle>
        </CardHeader>
        <CardContent>
          {data.cashBookings.length === 0 ? (
            <p className="text-sm text-muted-foreground">No cash bills in this period.</p>
          ) : (
            <div className="space-y-2">
              {data.cashBookings.map((row) => (
                <div
                  key={row.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3 text-sm"
                >
                  <div>
                    <Link href={`/bookings/${row.id}`} className="font-medium text-primary hover:underline">
                      {row.publicRef}
                    </Link>
                    <p className="text-muted-foreground">
                      {row.customerName} • {row.customerPhone}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold">{formatCurrency(row.totalAmount)}</p>
                    <p className="text-xs text-muted-foreground">
                      {PRODUCT_LABELS[row.productType as ProductType]} • {formatDateTime(row.createdAt)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Agent Performance</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {data.agentPerformance.map((agent) => (
              <div key={agent.name} className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <p className="font-medium">{agent.name}</p>
                  <p className="text-sm text-muted-foreground">{agent.count} bookings</p>
                </div>
                <p className="font-semibold">{formatCurrency(agent.revenue)}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
