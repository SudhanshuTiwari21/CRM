"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Loader2, Sparkles, Wallet } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PAYMENT_METHODS } from "@/lib/constants";
import { autoAllocatePayment, roundMoney, sumAllocations } from "@/lib/payment-allocation";
import {
  surplusToAdvance,
  totalAvailableForBills,
} from "@/lib/payment-surplus";
import { isGatewayMethod } from "@/lib/payment-utils";
import { formatCurrency, formatDate } from "@/lib/utils";

function walletAvailable(creditBalance: number | undefined) {
  return roundMoney(Math.max(0, -(creditBalance ?? 0)));
}

interface PendingBooking {
  id: string;
  publicRef: string;
  productType: string;
  totalAmount: number;
  paidAmount: number;
  amountDue: number;
  customerId: string;
  customerName: string;
  createdAt: string;
}

interface LedgerCustomer {
  customerId: string;
  customerName: string;
  customerPhone: string;
  creditBalance: number;
  totalDue: number;
  bookings: PendingBooking[];
}

interface CustomerOption {
  id: string;
  name: string;
  phone: string;
  creditBalance?: number;
}

export function RecordPaymentPanel({
  initialBookingId,
  initialBillingType,
}: {
  initialBookingId?: string;
  initialBillingType?: "CASH" | "LEDGER";
} = {}) {
  const [billingType, setBillingType] = useState<"LEDGER" | "CASH">(initialBillingType || "LEDGER");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [ledgerCustomers, setLedgerCustomers] = useState<LedgerCustomer[]>([]);
  const [cashBookings, setCashBookings] = useState<PendingBooking[]>([]);
  const [allCustomers, setAllCustomers] = useState<CustomerOption[]>([]);

  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [paymentAmount, setPaymentAmount] = useState("");
  const [walletAmount, setWalletAmount] = useState("");
  const [allocations, setAllocations] = useState<Record<string, string>>({});
  const [method, setMethod] = useState<string>("UPI");
  const [referenceNumber, setReferenceNumber] = useState("");
  const [note, setNote] = useState("");

  const loadPending = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/crm/payments/pending?billingType=${billingType}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load pending bookings");

      if (billingType === "LEDGER") {
        setLedgerCustomers(data.customers || []);
        setCashBookings([]);
      } else {
        setCashBookings(data.bookings || []);
        setLedgerCustomers([]);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load data");
    } finally {
      setLoading(false);
    }
  }, [billingType]);

  const loadCustomers = useCallback(async () => {
    try {
      const res = await fetch("/api/crm/customers?limit=100");
      const data = await res.json();
      if (!res.ok) return;
      setAllCustomers(
        (data.customers || []).map((c: CustomerOption & { creditBalance?: string | number }) => ({
          id: c.id,
          name: c.name,
          phone: c.phone,
          creditBalance: Number(c.creditBalance || 0),
        }))
      );
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    loadPending();
    loadCustomers();
  }, [billingType, loadPending, loadCustomers]);

  useEffect(() => {
    if (initialBookingId || initialBillingType) return;
    setSelectedCustomerId("");
    setPaymentAmount("");
    setWalletAmount("");
    setAllocations({});
    setReferenceNumber("");
    setNote("");
  }, [billingType, initialBookingId, initialBillingType]);

  useEffect(() => {
    if (!initialBookingId || loading) return;
    const allBookings = [
      ...cashBookings,
      ...ledgerCustomers.flatMap((c) => c.bookings),
    ];
    const booking = allBookings.find((b) => b.id === initialBookingId);
    if (!booking) return;
    if (booking.customerId) setSelectedCustomerId(booking.customerId);
    setPaymentAmount(String(booking.amountDue));
    setWalletAmount("");
    setAllocations({ [booking.id]: String(booking.amountDue) });
  }, [initialBookingId, loading, cashBookings, ledgerCustomers]);

  const outstandingBills: PendingBooking[] = useMemo(() => {
    if (billingType === "LEDGER") {
      if (!selectedCustomerId) return [];
      const customer = ledgerCustomers.find((c) => c.customerId === selectedCustomerId);
      return customer?.bookings || [];
    }
    return cashBookings;
  }, [billingType, selectedCustomerId, ledgerCustomers, cashBookings]);

  const receiptAmount = Number(paymentAmount) || 0;
  const walletApplied = Number(walletAmount) || 0;
  const allocatedTotal = sumAllocations(
    Object.fromEntries(
      Object.entries(allocations).map(([id, v]) => [id, Number(v) || 0])
    )
  );
  const availableForBills = totalAvailableForBills(receiptAmount, walletApplied);
  const unallocatedToBills = roundMoney(availableForBills - allocatedTotal);
  const advanceCredit = surplusToAdvance(receiptAmount, allocatedTotal, walletApplied);

  const ledgerCustomerDue = ledgerCustomers.find((c) => c.customerId === selectedCustomerId);
  const customerCreditBalance =
    ledgerCustomerDue?.creditBalance ??
    allCustomers.find((c) => c.id === selectedCustomerId)?.creditBalance;
  const availableWallet = walletAvailable(customerCreditBalance);

  function handleUseMaxWallet() {
    const cap = roundMoney(
      Math.min(availableWallet, allocatedTotal || receiptAmount || availableWallet)
    );
    if (cap <= 0) {
      toast.error("No wallet balance available");
      return;
    }
    setWalletAmount(String(cap));
  }

  function handleWalletOnly() {
    const total = allocatedTotal || receiptAmount;
    if (!total || total <= 0) {
      toast.error("Enter payment amount or allocate bills first");
      return;
    }
    const cap = roundMoney(Math.min(availableWallet, total));
    if (cap < total) {
      toast.error(
        `Wallet has only ${formatCurrency(cap)} - use mixed payment or reduce allocation`
      );
      return;
    }
    setWalletAmount(String(total));
  }

  function handleAllocationChange(bookingId: string, raw: string) {
    setAllocations((prev) => {
      const next = { ...prev };
      if (!raw || Number(raw) <= 0) {
        delete next[bookingId];
      } else {
        next[bookingId] = raw;
      }
      return next;
    });
  }

  function handleAutoAllocate() {
    if (!availableForBills || availableForBills <= 0) {
      toast.error("Enter payment amount first");
      return;
    }
    if (outstandingBills.length === 0) {
      toast.error("No outstanding bills to allocate");
      return;
    }
    const auto = autoAllocatePayment(outstandingBills, availableForBills);
    const next: Record<string, string> = {};
    for (const [id, val] of Object.entries(auto)) {
      if (val > 0) next[id] = String(val);
    }
    setAllocations(next);
    toast.success("Allocated oldest bills first (Tally-style FIFO)");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (receiptAmount <= 0 && walletApplied <= 0) {
      toast.error("Enter payment amount received");
      return;
    }

    if (billingType === "LEDGER" && !selectedCustomerId) {
      toast.error("Select a ledger customer");
      return;
    }

    if (billingType === "LEDGER" && walletApplied > 0 && walletApplied > availableWallet) {
      toast.error(`Wallet balance is only ${formatCurrency(availableWallet)}`);
      return;
    }

    const allocationList = Object.entries(allocations)
      .map(([bookingId, raw]) => ({ bookingId, amount: Number(raw) || 0 }))
      .filter((a) => a.amount > 0);

    if (billingType === "CASH") {
      if (walletApplied > 0) {
        toast.error("Wallet cannot be used for cash bills");
        return;
      }
      if (receiptAmount <= 0) {
        toast.error("Enter payment amount");
        return;
      }
      if (allocationList.length === 0) {
        toast.error("Allocate payment to at least one cash bill");
        return;
      }
      if (Math.abs(allocatedTotal - receiptAmount) > 0.01) {
        toast.error("Cash payment must be fully allocated to bills");
        return;
      }
    } else {
      if (allocatedTotal > availableForBills + 0.01) {
        toast.error("Allocated amount exceeds payment received plus wallet");
        return;
      }
    }

    for (const alloc of allocationList) {
      const bill = outstandingBills.find((b) => b.id === alloc.bookingId);
      if (bill && alloc.amount > bill.amountDue) {
        toast.error(`Allocation for ${bill.publicRef} exceeds due amount`);
        return;
      }
    }

    if (receiptAmount > 0 && isGatewayMethod(method) && !referenceNumber.trim()) {
      toast.error("Enter reference number for gateway payment");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        target: "BOOKING" as const,
        billingType,
        customerId: selectedCustomerId || undefined,
        amount: receiptAmount,
        walletAmount: billingType === "LEDGER" ? walletApplied : 0,
        allocations: allocationList,
        method:
          walletApplied >= allocatedTotal && allocatedTotal > 0 && receiptAmount <= 0
            ? "Wallet Balance"
            : method,
        referenceNumber: referenceNumber.trim() || undefined,
        note: note.trim() || undefined,
      };

      const res = await fetch("/api/crm/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to record payment");

      const parts: string[] = [];
      if (data.allocations?.length > 1) {
        parts.push(`allocated across ${data.allocations.length} bills`);
      } else if (data.allocations?.length === 1) {
        const first = data.allocations[0];
        parts.push(
          first.paymentStatus === "PAID"
            ? `${first.publicRef || "Bill"} fully paid`
            : `${formatCurrency(first.amountDue ?? 0)} remaining on bill`
        );
      }
      if (data.advanceCredited > 0) {
        parts.push(
          `${formatCurrency(data.advanceCredited)} credited to advance/wallet`
        );
      } else if (allocationList.length === 0 && receiptAmount > 0) {
        parts.push(`${formatCurrency(receiptAmount)} recorded as advance`);
      }

      toast.success(
        parts.length
          ? `Payment recorded - ${parts.join("; ")}`
          : "Payment recorded"
      );

      setPaymentAmount("");
      setWalletAmount("");
      setAllocations({});
      setReferenceNumber("");
      setNote("");
      loadPending();
      loadCustomers();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to record payment");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Record a Payment</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <Label>Billing type</Label>
          <Tabs
            value={billingType}
            onValueChange={(v) => setBillingType(v as "LEDGER" | "CASH")}
          >
            <TabsList>
              <TabsTrigger value="LEDGER">Ledger</TabsTrigger>
              <TabsTrigger value="CASH">Cash</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="rounded-lg border-2 border-primary/20 bg-primary/5 p-4 space-y-2">
            <Label className="text-base font-semibold">Payment amount received (INR) *</Label>
            <Input
              type="number"
              min={0.01}
              step="0.01"
              className="text-lg font-medium h-11"
              placeholder="Enter amount received from customer"
              value={paymentAmount}
              onChange={(e) => setPaymentAmount(e.target.value)}
              autoFocus
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {receiptAmount > 0 && (
              <>
                <div className="space-y-2">
                  <Label>Payment method *</Label>
                  <Select value={method} onValueChange={setMethod}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PAYMENT_METHODS.filter((m) => m !== "Wallet Balance").map((m) => (
                        <SelectItem key={m} value={m}>
                          {m}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Reference number{isGatewayMethod(method) ? " *" : ""}</Label>
                  <Input
                    value={referenceNumber}
                    onChange={(e) => setReferenceNumber(e.target.value)}
                    placeholder="Transaction / cheque / UTR number"
                  />
                </div>
              </>
            )}

            {billingType === "LEDGER" && (
              <div className="space-y-2 sm:col-span-2">
                <Label>Ledger customer *</Label>
                <Select
                  value={selectedCustomerId}
                  onValueChange={(v) => {
                    setSelectedCustomerId(v);
                    setAllocations({});
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select customer" />
                  </SelectTrigger>
                  <SelectContent>
                    {ledgerCustomers.map((c) => (
                      <SelectItem key={c.customerId} value={c.customerId}>
                        {c.customerName} - due {formatCurrency(c.totalDue)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {ledgerCustomerDue && (
                  <p className="text-xs text-muted-foreground">
                    Outstanding: {formatCurrency(ledgerCustomerDue.totalDue)}
                    {" · "}
                    Wallet available: {formatCurrency(availableWallet)}
                    {ledgerCustomerDue.creditBalance > 0 &&
                      ` (owes ${formatCurrency(ledgerCustomerDue.creditBalance)})`}
                  </p>
                )}
              </div>
            )}

            {billingType === "LEDGER" && selectedCustomerId && (
              <div className="space-y-2 sm:col-span-2 rounded-lg border bg-muted/30 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <Label className="flex items-center gap-1.5">
                      <Wallet className="h-3.5 w-3.5" />
                      Also use wallet / advance balance
                    </Label>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Available: {formatCurrency(availableWallet)} - optional, in addition to
                      receipt
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button type="button" variant="outline" size="sm" onClick={handleUseMaxWallet}>
                      Use max wallet
                    </Button>
                    <Button type="button" variant="outline" size="sm" onClick={handleWalletOnly}>
                      Wallet only
                    </Button>
                  </div>
                </div>
                <Input
                  type="number"
                  min={0}
                  max={availableWallet}
                  step="0.01"
                  placeholder="0.00"
                  value={walletAmount}
                  onChange={(e) => setWalletAmount(e.target.value)}
                />
              </div>
            )}

            <div className="space-y-2 sm:col-span-2">
              <Label>Billing narration / notes</Label>
              <Textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={2}
                placeholder="Payment notes or billing narration"
              />
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Label className="text-base">Allocate against outstanding bills</Label>
              {billingType === "LEDGER" && (
                <p className="text-xs text-muted-foreground">
                  Optional - leave blank to record full amount as advance
                </p>
              )}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleAutoAllocate}
                disabled={loading || outstandingBills.length === 0 || availableForBills <= 0}
              >
                <Sparkles className="mr-1.5 h-3.5 w-3.5" />
                Auto allocate (FIFO)
              </Button>
            </div>

            {billingType === "LEDGER" && !selectedCustomerId ? (
              <p className="text-sm text-muted-foreground py-6 text-center rounded-lg border border-dashed">
                Select a ledger customer to view outstanding bills
              </p>
            ) : loading ? (
              <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading outstanding bills…
              </div>
            ) : outstandingBills.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center rounded-lg border border-dashed">
                {billingType === "LEDGER"
                  ? "No outstanding bills - payment will be recorded as advance"
                  : "No outstanding cash bills"}
              </p>
            ) : (
              <>
                <div className="rounded-lg border overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Booking</TableHead>
                        <TableHead>Product</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead className="text-right">Due</TableHead>
                        <TableHead className="text-right w-[140px]">Allocate (INR)</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {outstandingBills.map((bill) => (
                        <TableRow key={bill.id}>
                          <TableCell>
                            <Link
                              href={`/bookings/${bill.id}`}
                              className="font-medium text-primary hover:underline"
                            >
                              {bill.publicRef}
                            </Link>
                            {billingType === "CASH" && (
                              <p className="text-xs text-muted-foreground">{bill.customerName}</p>
                            )}
                          </TableCell>
                          <TableCell>{bill.productType}</TableCell>
                          <TableCell className="whitespace-nowrap text-sm">
                            {formatDate(bill.createdAt)}
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {formatCurrency(bill.amountDue)}
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              min={0}
                              max={bill.amountDue}
                              step="0.01"
                              placeholder="0"
                              className="text-right"
                              value={allocations[bill.id] || ""}
                              onChange={(e) => handleAllocationChange(bill.id, e.target.value)}
                            />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                <div className="flex flex-wrap gap-4 text-sm rounded-lg bg-muted/40 p-3">
                  <p>
                    <span className="text-muted-foreground">Receipt:</span>{" "}
                    <span className="font-medium">{formatCurrency(receiptAmount)}</span>
                  </p>
                  {billingType === "LEDGER" && (
                    <p>
                      <span className="text-muted-foreground">Wallet:</span>{" "}
                      <span className="font-medium">{formatCurrency(walletApplied)}</span>
                    </p>
                  )}
                  <p>
                    <span className="text-muted-foreground">Available for bills:</span>{" "}
                    <span className="font-medium">{formatCurrency(availableForBills)}</span>
                  </p>
                  <p>
                    <span className="text-muted-foreground">Allocated:</span>{" "}
                    <span className="font-medium">{formatCurrency(allocatedTotal)}</span>
                  </p>
                  {unallocatedToBills > 0.01 && allocatedTotal > 0 && (
                    <p>
                      <span className="text-muted-foreground">Unallocated (wallet+receipt):</span>{" "}
                      <span className="font-medium text-amber-700 dark:text-amber-400">
                        {formatCurrency(unallocatedToBills)}
                      </span>
                    </p>
                  )}
                  {advanceCredit > 0.01 && (
                    <p>
                      <span className="text-muted-foreground">→ Advance credit:</span>{" "}
                      <span className="font-medium text-green-700 dark:text-green-400">
                        {formatCurrency(advanceCredit)}
                      </span>
                    </p>
                  )}
                  {allocatedTotal === 0 && receiptAmount > 0 && billingType === "LEDGER" && (
                    <p>
                      <span className="text-muted-foreground">→ Full amount to advance:</span>{" "}
                      <span className="font-medium text-green-700 dark:text-green-400">
                        {formatCurrency(receiptAmount)}
                      </span>
                    </p>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  Like Tally: enter receipt, allocate against bills (FIFO optional), surplus
                  auto-credits to customer advance. All entries appear in the Customer Ledger.
                </p>
              </>
            )}
          </div>

          <div className="flex justify-end">
            <Button type="submit" disabled={saving || loading}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Record Payment
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
