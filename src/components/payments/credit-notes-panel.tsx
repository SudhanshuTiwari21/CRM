"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, Plus } from "lucide-react";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatDate } from "@/lib/utils";

interface CreditNoteRow {
  id: string;
  publicRef: string;
  amount: number;
  billingType: string | null;
  reason: string | null;
  notes: string | null;
  source: string;
  createdAt: string;
  customer: { id: string; name: string; phone: string };
  booking: { id: string; publicRef: string; productType: string } | null;
  createdBy: { name: string } | null;
}

interface CustomerOption {
  id: string;
  name: string;
  phone: string;
}

export function CreditNotesPanel() {
  const [creditNotes, setCreditNotes] = useState<CreditNoteRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [customers, setCustomers] = useState<CustomerOption[]>([]);

  const [customerId, setCustomerId] = useState("");
  const [bookingPublicRef, setBookingPublicRef] = useState("");
  const [amount, setAmount] = useState("");
  const [billingType, setBillingType] = useState<string>("");
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");

  const loadNotes = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/crm/credit-notes?limit=50");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load credit notes");
      setCreditNotes(
        (data.creditNotes || []).map((n: CreditNoteRow & { amount: string | number }) => ({
          ...n,
          amount: Number(n.amount),
        }))
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load credit notes");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadNotes();
    fetch("/api/crm/customers?limit=100")
      .then((r) => r.json())
      .then((d) => setCustomers(d.customers || []))
      .catch(() => setCustomers([]));
  }, [loadNotes]);

  function resetForm() {
    setCustomerId("");
    setBookingPublicRef("");
    setAmount("");
    setBillingType("");
    setReason("");
    setNotes("");
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const parsed = Number(amount);
    if (!customerId) {
      toast.error("Select a customer");
      return;
    }
    if (!parsed || parsed <= 0) {
      toast.error("Enter a valid amount");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/crm/credit-notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId,
          bookingPublicRef: bookingPublicRef.trim() || undefined,
          amount: parsed,
          billingType: billingType || undefined,
          reason: reason.trim() || undefined,
          notes: notes.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create credit note");

      toast.success(`Credit note ${data.publicRef} created`);
      setDialogOpen(false);
      resetForm();
      loadNotes();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create credit note");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Credit Notes</CardTitle>
          <Button size="sm" onClick={() => { resetForm(); setDialogOpen(true); }}>
            <Plus className="mr-2 h-4 w-4" />
            Create Credit Note
          </Button>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : creditNotes.length === 0 ? (
            <p className="py-12 text-center text-sm text-muted-foreground">No credit notes yet</p>
          ) : (
            <div className="rounded-lg border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Ref</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Booking</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {creditNotes.map((n) => (
                    <TableRow key={n.id}>
                      <TableCell className="font-medium">{n.publicRef}</TableCell>
                      <TableCell>
                        <Link href={`/customers/${n.customer.id}`} className="hover:underline">
                          {n.customer.name}
                        </Link>
                      </TableCell>
                      <TableCell>
                        {n.booking ? (
                          <Link href={`/bookings/${n.booking.id}`} className="hover:underline">
                            {n.booking.publicRef}
                          </Link>
                        ) : (
                          "-"
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant={n.source === "AUTO_CANCEL" ? "secondary" : "outline"}>
                          {n.source === "AUTO_CANCEL" ? "Cancellation" : "Manual"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">{formatCurrency(n.amount)}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {formatDate(n.createdAt)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create Credit Note</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="space-y-2">
              <Label>Customer *</Label>
              <Select value={customerId} onValueChange={setCustomerId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select customer" />
                </SelectTrigger>
                <SelectContent>
                  {customers.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name} ({c.phone})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Booking ref (optional)</Label>
              <Input
                value={bookingPublicRef}
                onChange={(e) => setBookingPublicRef(e.target.value)}
                placeholder="e.g. BTR-2025-000123"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Amount (INR) *</Label>
                <Input
                  type="number"
                  min={0.01}
                  step="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Billing type</Label>
                <Select value={billingType || "__none__"} onValueChange={(v) => setBillingType(v === "__none__" ? "" : v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Optional" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Not specified</SelectItem>
                    <SelectItem value="LEDGER">Ledger</SelectItem>
                    <SelectItem value="CASH">Cash</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Reason</Label>
              <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Service adjustment" />
            </div>

            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
            </div>

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Create
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
