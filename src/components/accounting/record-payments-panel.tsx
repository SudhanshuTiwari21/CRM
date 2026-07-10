"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, Receipt } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PAYMENT_METHODS } from "@/lib/constants";
import { isGatewayMethod } from "@/lib/payment-utils";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/utils";

interface PendingPaymentRecord {
  id: string;
  amount: number;
  method: string;
  paidAt: string;
  gatewayRef: string | null;
}

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
  payments: PendingPaymentRecord[];
}

interface Report {
  ledger: {
    summary: { customers: number; bookings: number; totalDue: number };
    customers: { customerId: string; customerName: string }[];
  };
  cash: { summary: { bookings: number; totalDue: number } };
  all: PendingBookingRow[];
}

function PaymentBadge({ status }: { status: string }) {
  const variant =
    status === "ON_CREDIT"
      ? "info"
      : status === "PARTIAL"
        ? "secondary"
        : status === "PENDING"
          ? "warning"
          : "outline";
  return <Badge variant={variant}>{status.replace(/_/g, " ")}</Badge>;
}

function RecordPaymentDialog({
  booking,
  open,
  onOpenChange,
  onRecorded,
}: {
  booking: PendingBookingRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRecorded: () => void;
}) {
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<string>("UPI");
  const [gatewayRef, setGatewayRef] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (booking && open) {
      setAmount(String(booking.amountDue));
      setMethod("UPI");
      setGatewayRef("");
      setNote("");
    }
  }, [booking, open]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!booking) return;

    const parsed = Number(amount);
    if (!parsed || parsed <= 0) {
      toast.error("Enter a valid amount");
      return;
    }
    if (parsed > booking.amountDue) {
      toast.error(`Amount cannot exceed ${formatCurrency(booking.amountDue)}`);
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`/api/crm/bookings/${booking.id}/payments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: parsed,
          method,
          gatewayRef: gatewayRef.trim() || undefined,
          note: note.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to record payment");

      toast.success(
        data.paymentStatus === "PAID"
          ? "Payment recorded - booking fully paid"
          : `Payment recorded - ${formatCurrency(data.amountDue)} remaining`
      );
      onOpenChange(false);
      onRecorded();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to record payment");
    } finally {
      setSaving(false);
    }
  }

  if (!booking) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Record Payment - {booking.publicRef}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="rounded-lg border bg-muted/40 p-3 text-sm space-y-1">
            <p>
              <span className="text-muted-foreground">Customer:</span> {booking.customerName}
            </p>
            <p>
              <span className="text-muted-foreground">Total:</span> {formatCurrency(booking.totalAmount)}
              {" · "}
              <span className="text-muted-foreground">Paid:</span> {formatCurrency(booking.paidAmount)}
              {" · "}
              <span className="font-medium">Due: {formatCurrency(booking.amountDue)}</span>
            </p>
          </div>

          <div className="space-y-2">
            <Label>Amount received (INR)</Label>
            <Input
              type="number"
              min={0.01}
              step="0.01"
              max={booking.amountDue}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
            />
            <p className="text-xs text-muted-foreground">
              Partial payments are allowed - enter any amount up to the balance due.
            </p>
          </div>

          <div className="space-y-2">
            <Label>Payment method</Label>
            <Select value={method} onValueChange={setMethod}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PAYMENT_METHODS.map((m) => (
                  <SelectItem key={m} value={m}>
                    {m}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {isGatewayMethod(method) && (
            <div className="space-y-2">
              <Label>Gateway reference / transaction ID</Label>
              <Input
                value={gatewayRef}
                onChange={(e) => setGatewayRef(e.target.value)}
                placeholder="e.g. pay_abc123"
              />
            </div>
          )}

          <div className="space-y-2">
            <Label>Note (optional)</Label>
            <Input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Internal note"
            />
          </div>

          {booking.payments.length > 0 && (
            <div className="space-y-2">
              <Label className="text-muted-foreground">Previous payments</Label>
              <div className="max-h-32 space-y-1 overflow-y-auto rounded border p-2 text-xs">
                {booking.payments.map((p) => (
                  <div key={p.id} className="flex justify-between">
                    <span>
                      {formatCurrency(p.amount)} · {p.method}
                      {p.gatewayRef ? ` · ${p.gatewayRef}` : ""}
                    </span>
                    <span className="text-muted-foreground">{formatDateTime(p.paidAt)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Record Payment
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function PaymentsTable({
  rows,
  onRecord,
}: {
  rows: PendingBookingRow[];
  onRecord: (row: PendingBookingRow) => void;
}) {
  if (rows.length === 0) {
    return <p className="py-12 text-center text-sm text-muted-foreground">No pending payments</p>;
  }

  return (
    <div className="rounded-lg border overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Booking</TableHead>
            <TableHead>Customer</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Status</TableHead>
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
                <p className="text-xs text-muted-foreground">{formatDate(r.createdAt)}</p>
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
              <TableCell>
                <p>{r.productType}</p>
                <p className="text-xs text-muted-foreground">{r.billingType}</p>
              </TableCell>
              <TableCell>
                <PaymentBadge status={r.paymentStatus} />
                {r.payments.length > 0 && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    {r.payments.length} payment{r.payments.length > 1 ? "s" : ""}
                  </p>
                )}
              </TableCell>
              <TableCell className="text-right">{formatCurrency(r.totalAmount)}</TableCell>
              <TableCell className="text-right text-muted-foreground">
                {formatCurrency(r.paidAmount)}
              </TableCell>
              <TableCell className="text-right font-semibold">{formatCurrency(r.amountDue)}</TableCell>
              <TableCell className="text-right">
                <Button size="sm" variant="outline" onClick={() => onRecord(r)}>
                  <Receipt className="mr-1 h-3.5 w-3.5" />
                  Record
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export function RecordPaymentsPanel() {
  const [loading, setLoading] = useState(true);
  const [report, setReport] = useState<Report | null>(null);
  const [selected, setSelected] = useState<PendingBookingRow | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

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

  function openRecord(row: PendingBookingRow) {
    setSelected(row);
    setDialogOpen(true);
  }

  if (loading || !report) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const ledgerRows = report.all.filter((r) => r.billingType === "LEDGER");
  const cashRows = report.all.filter((r) => r.billingType === "CASH");
  const totalDue = report.all.reduce((s, r) => s + r.amountDue, 0);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Open Bookings</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{report.all.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Total Outstanding</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{formatCurrency(totalDue)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Ledger / Cash</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {ledgerRows.length} / {cashRows.length}
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="all">
        <TabsList>
          <TabsTrigger value="all">All ({report.all.length})</TabsTrigger>
          <TabsTrigger value="ledger">Ledger ({ledgerRows.length})</TabsTrigger>
          <TabsTrigger value="cash">Cash Bills ({cashRows.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="mt-4">
          <PaymentsTable rows={report.all} onRecord={openRecord} />
        </TabsContent>
        <TabsContent value="ledger" className="mt-4">
          <PaymentsTable rows={ledgerRows} onRecord={openRecord} />
        </TabsContent>
        <TabsContent value="cash" className="mt-4">
          <PaymentsTable rows={cashRows} onRecord={openRecord} />
        </TabsContent>
      </Tabs>

      <RecordPaymentDialog
        booking={selected}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onRecorded={fetchData}
      />
    </div>
  );
}
