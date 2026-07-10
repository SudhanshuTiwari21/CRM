"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, Receipt } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatDate } from "@/lib/utils";

interface PendingBookingRow {
  id: string;
  publicRef: string;
  productType: string;
  billingType: string;
  paymentStatus: string;
  totalAmount: number;
  paidAmount: number;
  amountDue: number;
  createdAt: string;
  pnr: string | null;
  customerId: string;
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
    return <p className="py-8 text-center text-sm text-muted-foreground">No outstanding bills</p>;
  }

  return (
    <div className="rounded-lg border overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Booking</TableHead>
            <TableHead>Customer</TableHead>
            <TableHead>Product</TableHead>
            <TableHead>Bill Type</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Date</TableHead>
            <TableHead className="text-right">Total</TableHead>
            <TableHead className="text-right">Paid</TableHead>
            <TableHead className="text-right">Due</TableHead>
            <TableHead />
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
                {r.billingType === "LEDGER" ? (
                  <Link href={`/customers/${r.customerId}`} className="hover:underline">
                    {r.customerName}
                  </Link>
                ) : (
                  <p>{r.customerName}</p>
                )}
                <p className="text-xs text-muted-foreground">{r.customerPhone}</p>
              </TableCell>
              <TableCell>{r.productType}</TableCell>
              <TableCell>
                <Badge variant="outline">{r.billingType}</Badge>
              </TableCell>
              <TableCell>
                <PaymentBadge status={r.paymentStatus} />
              </TableCell>
              <TableCell className="whitespace-nowrap">{formatDate(r.createdAt)}</TableCell>
              <TableCell className="text-right">{formatCurrency(r.totalAmount)}</TableCell>
              <TableCell className="text-right text-muted-foreground">
                {formatCurrency(r.paidAmount)}
              </TableCell>
              <TableCell className="text-right font-medium text-amber-700 dark:text-amber-400">
                {formatCurrency(r.amountDue)}
              </TableCell>
              <TableCell>
                <Button size="sm" variant="outline" asChild>
                  <Link
                    href={`/payments?tab=record&bookingId=${r.id}&billingType=${r.billingType}`}
                  >
                    <Receipt className="mr-1.5 h-3.5 w-3.5" />
                    Pay
                  </Link>
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export function OutstandingBillsPanel() {
  const [loading, setLoading] = useState(true);
  const [report, setReport] = useState<Report | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/crm/accounting/pending-payments");
      const data = await res.json();
      setReport(data);
    } finally {
      setLoading(false);
    }
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

  const totalOutstanding =
    report.ledger.summary.totalDue + report.cash.summary.totalDue;
  const totalBills = report.ledger.summary.bookings + report.cash.summary.bookings;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Outstanding Bills</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{totalBills}</p>
            <p className="text-xs text-muted-foreground">Awaiting payment</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Total Due</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-amber-700 dark:text-amber-400">
              {formatCurrency(totalOutstanding)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Ledger Dues</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{formatCurrency(report.ledger.summary.totalDue)}</p>
            <p className="text-xs text-muted-foreground">
              {report.ledger.summary.customers} customers · {report.ledger.summary.bookings} bills
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Cash Dues</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{formatCurrency(report.cash.summary.totalDue)}</p>
            <p className="text-xs text-muted-foreground">{report.cash.summary.bookings} bills</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="all">
        <TabsList>
          <TabsTrigger value="all">All ({totalBills})</TabsTrigger>
          <TabsTrigger value="ledger">
            Ledger ({report.ledger.summary.bookings})
          </TabsTrigger>
          <TabsTrigger value="cash">Cash ({report.cash.summary.bookings})</TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="mt-4">
          <BookingRows
            rows={[
              ...report.ledger.customers.flatMap((c) => c.bookings),
              ...report.cash.bookings,
            ].sort((a, b) => b.amountDue - a.amountDue)}
          />
        </TabsContent>

        <TabsContent value="ledger" className="mt-4 space-y-4">
          {report.ledger.customers.length === 0 ? (
            <p className="py-12 text-center text-muted-foreground">No ledger outstanding bills</p>
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
                      <p className="font-semibold text-amber-700 dark:text-amber-400">
                        {formatCurrency(c.totalDue)} due
                      </p>
                      {c.creditEnabled && (
                        <p className="text-muted-foreground">
                          Wallet: {formatCurrency(c.creditBalance)}
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
