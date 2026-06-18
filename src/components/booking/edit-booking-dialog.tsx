"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Pencil } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface EditBookingDialogProps {
  bookingId: string;
  productType: string;
  pnr?: string | null;
  internalNotes?: string | null;
  totalAmount: number;
  flight?: {
    invoiceNarration?: string | null;
    showPassengerName?: boolean;
    baseFare?: unknown;
    serviceCharge?: unknown;
    discountAmount?: unknown;
  } | null;
}

export function EditBookingDialog({
  bookingId,
  productType,
  pnr,
  internalNotes,
  totalAmount,
  flight,
}: EditBookingDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    pnr: pnr || "",
    internalNotes: internalNotes || "",
    totalAmount: String(totalAmount),
    invoiceNarration: flight?.invoiceNarration || "",
    showPassengerName: flight?.showPassengerName !== false,
    baseFare: flight?.baseFare != null ? String(flight.baseFare) : "",
    serviceCharge: flight?.serviceCharge != null ? String(flight.serviceCharge) : "",
    discountAmount: flight?.discountAmount != null ? String(flight.discountAmount) : "",
  });

  async function handleSave() {
    setLoading(true);
    try {
      const payload: Record<string, unknown> = {
        pnr: form.pnr.trim() || undefined,
        internalNotes: form.internalNotes,
        regenerateDocuments: true,
      };

      if (productType !== "FLIGHT") {
        payload.totalAmount = Number(form.totalAmount);
      } else {
        payload.invoiceNarration = form.invoiceNarration;
        payload.showPassengerName = form.showPassengerName;
        if (form.baseFare) payload.baseFare = Number(form.baseFare);
        if (form.serviceCharge) payload.serviceCharge = Number(form.serviceCharge);
        if (form.discountAmount) payload.discountAmount = Number(form.discountAmount);
        if (form.totalAmount) payload.totalAmount = Number(form.totalAmount);
      }

      const res = await fetch(`/api/crm/bookings/${bookingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Update failed");

      toast.success("Booking updated — documents regenerated");
      setOpen(false);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Update failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Pencil className="mr-2 h-4 w-4" />
          Edit Booking
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit Booking</DialogTitle>
          <DialogDescription>
            Admin only. Changes regenerate invoice and voucher PDFs.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div className="space-y-2">
            <Label>PNR / Confirmation</Label>
            <Input value={form.pnr} onChange={(e) => setForm({ ...form, pnr: e.target.value })} />
          </div>

          {productType === "FLIGHT" && (
            <>
              <div className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <Label>Show passenger name on invoice</Label>
                  <p className="text-xs text-muted-foreground">Hide for privacy-sensitive B2B invoices</p>
                </div>
                <Button
                  type="button"
                  variant={form.showPassengerName ? "default" : "outline"}
                  size="sm"
                  onClick={() => setForm({ ...form, showPassengerName: !form.showPassengerName })}
                >
                  {form.showPassengerName ? "Yes" : "No"}
                </Button>
              </div>
              <div className="space-y-2">
                <Label>Invoice Remarks / Narration</Label>
                <Textarea
                  value={form.invoiceNarration}
                  onChange={(e) => setForm({ ...form, invoiceNarration: e.target.value })}
                  rows={3}
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Base Fare</Label>
                  <Input
                    type="number"
                    value={form.baseFare}
                    onChange={(e) => setForm({ ...form, baseFare: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Service Charge</Label>
                  <Input
                    type="number"
                    value={form.serviceCharge}
                    onChange={(e) => setForm({ ...form, serviceCharge: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Discount</Label>
                  <Input
                    type="number"
                    value={form.discountAmount}
                    onChange={(e) => setForm({ ...form, discountAmount: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Total Amount</Label>
                  <Input
                    type="number"
                    value={form.totalAmount}
                    onChange={(e) => setForm({ ...form, totalAmount: e.target.value })}
                  />
                </div>
              </div>
            </>
          )}

          {productType !== "FLIGHT" && (
            <div className="space-y-2">
              <Label>Total Amount</Label>
              <Input
                type="number"
                value={form.totalAmount}
                onChange={(e) => setForm({ ...form, totalAmount: e.target.value })}
              />
            </div>
          )}

          <div className="space-y-2">
            <Label>Internal Notes</Label>
            <Textarea
              value={form.internalNotes}
              onChange={(e) => setForm({ ...form, internalNotes: e.target.value })}
              rows={3}
            />
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setOpen(false)} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save & Regenerate
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
