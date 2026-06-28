"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatDate } from "@/lib/utils";

interface PendingBookingRow {
  id: string;
  publicRef: string;
  productType: string;
  paymentStatus: string;
  totalAmount: number;
  paidAmount: number;
  amountDue: number;
  createdAt: string;
  pnr: string | null;
  customerName: string;
  customerPhone: string;
}

interface LedgerCustomerDue {
  customerId: string;
  customerName: string;
  customerPhone: string;
  creditEnabled: boolean;
  creditBalance: number;
  creditLimit: number | null;
  bookings: PendingBookingRow[];
  totalDue: number;
}

interface Report {
  ledger: {
    summary: { customers: number; bookings: number; totalDue: number };
    customers: LedgerCustomerDue[];
  };
  cash: {
    summary: { bookings: number; totalDue: number };
    bookings: PendingBookingRow[];
  };
}

function PaymentBadge({ status }: { status: string }) {
  const variant =
    status === "ON_CREDIT"
      ? "info"
      : status === "PARTIAL"
        ? "secondary"
        : status === "PENDING"
          ? "warning"
          : "secondary";
  return <Badge variant={variant}>{status.replace(/_/g, " ")}</Badge>;
}

function BookingRows({ rows }: { rows: PendingBookingRow[] }) {
  if (rows.length === 0) {
    return <p className="py-8 text-center text-sm text-muted-foreground">No pending bookings</p>;
  }
  return (
    <div className="rounded-lg border overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Booking</TableHead>
            <TableHead>Customer</TableHead>
            <TableHead>Product</TableHead>
            <TableHead>Payment</TableHead>
            <TableHead>Date</TableHead>
            <TableHead className="text-right">Total</TableHead>
            <TableHead className="text-right">Paid</TableHead>
            <TableHead className="text-right">Due</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.id}>
              <TableCell>
                <Link href={`/bookings/${r.id}`} className="font-medium text-primary hover:underline">
                  {r.publicRef}
                </Link>
                {r.pnr && <p className="text-xs text-muted-foreground">PNR {r.pnr}</p>}
              </TableCell>
              <TableCell>
                <p>{r.customerName}</p>
                <p className="text-xs text-muted-foreground">{r.customerPhone}</p>
              </TableCell>
              <TableCell>{r.productType}</TableCell>
              <TableCell><PaymentBadge status={r.paymentStatus} /></TableCell>
              <TableCell className="whitespace-nowrap">{formatDate(r.createdAt)}</TableCell>
              <TableCell className="text-right">{formatCurrency(r.totalAmount)}</TableCell>
              <TableCell className="text-right text-muted-foreground">
                {formatCurrency(r.paidAmount ?? 0)}
              </TableCell>
              <TableCell className="text-right font-medium">
                {formatCurrency(r.amountDue ?? r.totalAmount)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export function PendingPaymentsPanel() {
  const [loading, setLoading] = useState(true);
  const [report, setReport] = useState<Report | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/crm/accounting/pending-payments");
    const data = await res.json();
    setReport(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading || !report) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Ledger Customers</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{report.ledger.summary.customers}</p>
            <p className="text-xs text-muted-foreground">{report.ledger.summary.bookings} open bookings</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Ledger Dues</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{formatCurrency(report.ledger.summary.totalDue)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Cash Bills Pending</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{report.cash.summary.bookings}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Cash Dues</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{formatCurrency(report.cash.summary.totalDue)}</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="ledger">
        <TabsList>
          <TabsTrigger value="ledger">
            Ledger Wise ({report.ledger.summary.customers})
          </TabsTrigger>
          <TabsTrigger value="cash">
            Cash Bills ({report.cash.summary.bookings})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="ledger" className="mt-4 space-y-4">
          {report.ledger.customers.length === 0 ? (
            <p className="py-12 text-center text-muted-foreground">No ledger dues</p>
          ) : (
            report.ledger.customers.map((c) => (
              <Card key={c.customerId}>
                <CardHeader className="pb-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <CardTitle className="text-base">
                        <Link href={`/customers/${c.customerId}`} className="hover:underline">
                          {c.customerName}
                        </Link>
                      </CardTitle>
                      <p className="text-sm text-muted-foreground">{c.customerPhone}</p>
                    </div>
                    <div className="text-right text-sm">
                      <p className="font-semibold">{formatCurrency(c.totalDue)} due</p>
                      {c.creditEnabled && (
                        <p className="text-muted-foreground">
                          Credit bal: {formatCurrency(c.creditBalance)}
                          {c.creditLimit != null ? ` / ${formatCurrency(c.creditLimit)} limit` : ""}
                        </p>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <BookingRows rows={c.bookings} />
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="cash" className="mt-4">
          <BookingRows rows={report.cash.bookings} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
