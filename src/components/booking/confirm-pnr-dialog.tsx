"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface ConfirmPnrDialogProps {
  bookingId: string;
  existingPnr?: string | null;
  isRoundTrip?: boolean;
  resume?: boolean;
  isHotel?: boolean;
  hotelPendingSupplier?: boolean;
  trigger?: React.ReactNode;
}

export function ConfirmPnrDialog({
  bookingId,
  existingPnr,
  isRoundTrip,
  resume,
  isHotel,
  hotelPendingSupplier,
  trigger,
}: ConfirmPnrDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [pnr, setPnr] = useState(existingPnr || "");
  const [secondaryPnr, setSecondaryPnr] = useState("");
  const [supplierRef, setSupplierRef] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    try {
      const res = await fetch(`/api/crm/bookings/${bookingId}/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pnr, secondaryPnr: secondaryPnr || undefined, supplierRef: supplierRef || undefined }),
      });

      const data = await res.json();
      if (!res.ok) {
        if (res.status === 401) {
          throw new Error("Session expired or demo access not enabled on this server.");
        }
        throw new Error(data.error || "Failed to confirm");
      }

      toast.success(
        isHotel ? "Supplier confirmation saved! Voucher sent to customer." : "PNR confirmed! Documents generated and email sent."
      );
      setOpen(false);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to confirm PNR");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button>
            {isHotel
              ? hotelPendingSupplier
                ? "Add Supplier Confirmation"
                : "Enter Supplier Confirmation"
              : "Enter PNR"}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {isHotel ? "Supplier Hotel Confirmation" : "Confirm Booking PNR"}
          </DialogTitle>
          <DialogDescription>
            {resume
              ? "PNR was saved but ticket generation failed. Click below to generate PDFs and send the confirmation email."
              : isHotel
                ? hotelPendingSupplier
                  ? "Enter the hotel supplier confirmation number. This will regenerate the voucher and resend it to the customer."
                  : "Enter the confirmed supplier number from the hotel operator."
                : "Enter the confirmed PNR from the airline/hotel/bus operator. This will generate tickets and send confirmation email."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="pnr">
              {isHotel ? "Supplier Confirmation Number *" : "PNR / Confirmation Number *"}
            </Label>
            <Input
              id="pnr"
              value={pnr}
              onChange={(e) => setPnr(e.target.value.toUpperCase())}
              placeholder="e.g. UC6MWT"
              required
            />
          </div>
          {isRoundTrip && (
            <div className="space-y-2">
              <Label htmlFor="secondaryPnr">Return PNR (optional)</Label>
              <Input
                id="secondaryPnr"
                value={secondaryPnr}
                onChange={(e) => setSecondaryPnr(e.target.value.toUpperCase())}
                placeholder="Return leg PNR"
              />
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="supplierRef">Supplier Reference (optional)</Label>
            <Input
              id="supplierRef"
              value={supplierRef}
              onChange={(e) => setSupplierRef(e.target.value)}
              placeholder="Internal supplier ref"
            />
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {resume || hotelPendingSupplier ? "Regenerate & Send Voucher" : isHotel ? "Confirm & Send Voucher" : "Confirm & Send Ticket"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
