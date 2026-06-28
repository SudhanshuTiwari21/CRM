"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { CHANNEL_LABELS, PRODUCT_LABELS } from "@/lib/constants";
import type { BookingChannel, ProductType } from "@prisma/client";

interface ReportData {
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
  avgProcessingHours: number;
  totalBookings: number;
  totalRevenue: number;
}

export function ReportsDashboard() {
  const [days, setDays] = useState("30");
  const [data, setData] = useState<ReportData | null>(null);

  useEffect(() => {
    fetch(`/api/crm/reports?days=${days}`)
      .then((r) => r.json())
      .then(setData);
  }, [days]);

  if (!data) return <div className="py-8 text-center text-muted-foreground">Loading reports...</div>;

  const channelData = data.channelMix.map((c) => ({
    name: CHANNEL_LABELS[c.channel as BookingChannel] || c.channel,
    count: c.count,
    revenue: c.revenue,
  }));

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <Select value={days} onValueChange={setDays}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="7">Last 7 days</SelectItem>
            <SelectItem value="30">Last 30 days</SelectItem>
            <SelectItem value="90">Last 90 days</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Total Bookings</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold">{data.totalBookings}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Total Revenue</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold">{formatCurrency(data.totalRevenue)}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Cash Sales</CardTitle></CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{formatCurrency(data.cashRevenue)}</p>
            <p className="text-xs text-muted-foreground">{data.cashBookings.length} walk-in bills</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Ledger Sales</CardTitle></CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{formatCurrency(data.ledgerRevenue)}</p>
            <p className="text-xs text-muted-foreground">Registered customer bills</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">Revenue Trend</CardTitle></CardHeader>
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
          <CardHeader><CardTitle className="text-base">Channel Mix</CardTitle></CardHeader>
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
        <CardHeader><CardTitle className="text-base">Cash Sales (walk-in, no ledger profile)</CardTitle></CardHeader>
        <CardContent>
          {data.cashBookings.length === 0 ? (
            <p className="text-sm text-muted-foreground">No cash bills in this period.</p>
          ) : (
            <div className="space-y-2">
              {data.cashBookings.map((row) => (
                <div key={row.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3 text-sm">
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
        <CardHeader><CardTitle className="text-base">Agent Performance</CardTitle></CardHeader>
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
