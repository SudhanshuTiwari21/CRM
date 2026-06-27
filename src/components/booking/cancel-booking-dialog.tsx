"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Ban } from "lucide-react";
import { toast } from "sonner";
import type { BookingStatus, CancellationCategory, ProductType } from "@prisma/client";
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
import { Badge } from "@/components/ui/badge";
import { computeB2BNetRefund } from "@/lib/cancellation-category";
import { formatCurrency } from "@/lib/utils";

interface CancelBookingDialogProps {
  bookingId: string;
  publicRef: string;
  productType: ProductType;
  status: BookingStatus;
  totalAmount: number;
  category: CancellationCategory;
  creditEnabled?: boolean;
}

export function CancelBookingDialog({
  bookingId,
  publicRef,
  productType,
  status,
  totalAmount,
  category,
  creditEnabled,
}: CancelBookingDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");
  const [refundToCredit, setRefundToCredit] = useState(false);

  const [airlineRefund, setAirlineRefund] = useState("");
  const [supplierCharges, setSupplierCharges] = useState("");
  const [agencyCharges, setAgencyCharges] = useState("");

  const [customerRefund, setCustomerRefund] = useState("");
  const [cancellationFee, setCancellationFee] = useState("");
  const [supplierPenalty, setSupplierPenalty] = useState("");

  const isB2B = category === "B2B";
  const canCancel =
    (productType === "FLIGHT" || productType === "HOTEL") &&
    !["CANCELLED", "DRAFT", "PENDING_PAYMENT"].includes(status);

  const b2bNetRefund = useMemo(() => {
    if (!isB2B) return 0;
    return computeB2BNetRefund(
      parseFloat(airlineRefund) || 0,
      parseFloat(supplierCharges) || 0,
      parseFloat(agencyCharges) || 0
    );
  }, [isB2B, airlineRefund, supplierCharges, agencyCharges]);

  async function handleCancel() {
    if (!reason.trim()) {
      toast.error("Cancellation reason is required");
      return;
    }

    setLoading(true);
    try {
      const body =
        category === "B2B"
          ? {
              category: "B2B" as const,
              reason: reason.trim(),
              airlineRefund: parseFloat(airlineRefund) || 0,
              supplierCharges: parseFloat(supplierCharges) || 0,
              agencyCharges: parseFloat(agencyCharges) || 0,
              refundToCredit,
              notes: notes.trim() || undefined,
            }
          : {
              category: "B2C" as const,
              reason: reason.trim(),
              customerRefund: parseFloat(customerRefund) || 0,
              cancellationFee: parseFloat(cancellationFee) || 0,
              supplierPenalty: parseFloat(supplierPenalty) || 0,
              refundToCredit,
              notes: notes.trim() || undefined,
            };

      const res = await fetch(`/api/crm/bookings/${bookingId}/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Cancellation failed");

      toast.success(`${publicRef} cancelled`);
      setOpen(false);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Cancellation failed");
    } finally {
      setLoading(false);
    }
  }

  if (!canCancel) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="border-amber-300 text-amber-800 hover:bg-amber-50 dark:border-amber-700 dark:text-amber-200 dark:hover:bg-amber-950/30">
          <Ban className="mr-2 h-4 w-4" />
          Cancel Booking
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Cancel {publicRef}</DialogTitle>
          <DialogDescription>
            Record cancellation details. Booking status will be set to Cancelled. Original booking
            and invoice serial are preserved for GST compliance.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline">{productType === "FLIGHT" ? "Flight" : "Hotel"}</Badge>
            <Badge variant={isB2B ? "default" : "secondary"}>
              {isB2B ? "B2B" : "B2C"} cancellation
            </Badge>
            <Badge variant="outline">Booked: {formatCurrency(totalAmount)}</Badge>
          </div>

          <div className="space-y-2">
            <Label htmlFor="cancel-reason">Reason *</Label>
            <Input
              id="cancel-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Customer requested cancellation"
            />
          </div>

          {isB2B ? (
            <div className="space-y-3 rounded-lg border bg-muted/30 p-4">
              <p className="text-sm font-medium">B2B refund breakup</p>
              <div className="space-y-2">
                <Label htmlFor="airline-refund">Refund from airlines</Label>
                <Input
                  id="airline-refund"
                  type="number"
                  min="0"
                  step="0.01"
                  value={airlineRefund}
                  onChange={(e) => setAirlineRefund(e.target.value)}
                  placeholder="0.00"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="supplier-charges">Other taxes & charges (B2B supplier)</Label>
                <Input
                  id="supplier-charges"
                  type="number"
                  min="0"
                  step="0.01"
                  value={supplierCharges}
                  onChange={(e) => setSupplierCharges(e.target.value)}
                  placeholder="0.00"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="agency-charges">Other taxes & charges (by us)</Label>
                <Input
                  id="agency-charges"
                  type="number"
                  min="0"
                  step="0.01"
                  value={agencyCharges}
                  onChange={(e) => setAgencyCharges(e.target.value)}
                  placeholder="0.00"
                />
              </div>
              <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">
                Net refund: {formatCurrency(b2bNetRefund)}
              </p>
            </div>
          ) : (
            <div className="space-y-3 rounded-lg border bg-muted/30 p-4">
              <p className="text-sm font-medium">B2C refund breakup</p>
              <div className="space-y-2">
                <Label htmlFor="customer-refund">Refund to customer</Label>
                <Input
                  id="customer-refund"
                  type="number"
                  min="0"
                  step="0.01"
                  value={customerRefund}
                  onChange={(e) => setCustomerRefund(e.target.value)}
                  placeholder="0.00"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cancellation-fee">Cancellation fee (by us)</Label>
                <Input
                  id="cancellation-fee"
                  type="number"
                  min="0"
                  step="0.01"
                  value={cancellationFee}
                  onChange={(e) => setCancellationFee(e.target.value)}
                  placeholder="0.00"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="supplier-penalty">Supplier / airline penalty</Label>
                <Input
                  id="supplier-penalty"
                  type="number"
                  min="0"
                  step="0.01"
                  value={supplierPenalty}
                  onChange={(e) => setSupplierPenalty(e.target.value)}
                  placeholder="0.00"
                />
              </div>
            </div>
          )}

          {creditEnabled && (
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={refundToCredit}
                onChange={(e) => setRefundToCredit(e.target.checked)}
                className="h-4 w-4 rounded border"
              />
              Refund to customer credit account
            </label>
          )}

          <div className="space-y-2">
            <Label htmlFor="cancel-notes">Internal notes</Label>
            <Textarea
              id="cancel-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional notes for accounting..."
              rows={2}
            />
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setOpen(false)} disabled={loading}>
            Close
          </Button>
          <Button
            variant="destructive"
            onClick={handleCancel}
            disabled={loading || !reason.trim()}
          >
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Confirm cancellation
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
