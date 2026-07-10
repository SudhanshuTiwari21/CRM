"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatDateTime } from "@/lib/utils";

interface PaymentRow {
  id: string;
  amount: number;
  method: string;
  referenceNumber: string | null;
  note: string | null;
  billingType: string | null;
  paidAt: string;
  booking: {
    id: string;
    publicRef: string;
    productType: string;
    billingType: string;
    customer: { name: string };
  } | null;
  customer: { id: string; name: string } | null;
  createdBy: { name: string } | null;
}

export function PaymentHistoryPanel() {
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/crm/payments?limit=50");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load payments");
      setPayments(
        (data.payments || []).map((p: PaymentRow & { amount: string | number }) => ({
          ...p,
          amount: Number(p.amount),
        }))
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load payments");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Recent Payments</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : payments.length === 0 ? (
          <p className="py-12 text-center text-sm text-muted-foreground">No payments recorded yet</p>
        ) : (
          <div className="rounded-lg border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Reference</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead>UTR / Note</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payments.map((p) => {
                  const isAdvance = !p.booking;
                  const customerName = p.booking?.customer.name || p.customer?.name || "-";
                  return (
                    <TableRow key={p.id}>
                      <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                        {formatDateTime(p.paidAt)}
                      </TableCell>
                      <TableCell>
                        {isAdvance ? (
                          <Badge variant="info">Advance</Badge>
                        ) : (
                          <>
                            <Link
                              href={`/bookings/${p.booking!.id}`}
                              className="font-medium text-primary hover:underline"
                            >
                              {p.booking!.publicRef}
                            </Link>
                            <Badge variant="outline" className="ml-1 text-xs">
                              {p.booking!.billingType}
                            </Badge>
                          </>
                        )}
                      </TableCell>
                      <TableCell className="text-sm">
                        {isAdvance ? (
                          p.referenceNumber || "-"
                        ) : (
                          p.booking!.productType
                        )}
                      </TableCell>
                      <TableCell>
                        {p.customer?.id ? (
                          <Link href={`/customers/${p.customer.id}`} className="hover:underline">
                            {customerName}
                          </Link>
                        ) : (
                          customerName
                        )}
                      </TableCell>
                      <TableCell>{p.method}</TableCell>
                      <TableCell className="max-w-[140px] truncate text-sm">
                        {p.referenceNumber || p.note || "-"}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(p.amount)}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
