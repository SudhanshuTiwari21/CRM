"use client";

import { useEffect, useState } from "react";
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

type ConfirmPassenger = {
  firstName: string;
  lastName?: string;
  ticketNumber?: string;
};

interface ConfirmPnrDialogProps {
  bookingId: string;
  existingPnr?: string | null;
  isRoundTrip?: boolean;
  resume?: boolean;
  isHotel?: boolean;
  hotelPendingSupplier?: boolean;
  showEticket?: boolean;
  passengers?: ConfirmPassenger[];
  trigger?: React.ReactNode;
}

function passengerLabel(p: ConfirmPassenger) {
  return `${p.firstName} ${p.lastName || ""}`.trim();
}

export function ConfirmPnrDialog({
  bookingId,
  existingPnr,
  isRoundTrip,
  resume,
  isHotel,
  hotelPendingSupplier,
  showEticket,
  passengers = [],
  trigger,
}: ConfirmPnrDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [pnr, setPnr] = useState(existingPnr || "");
  const [secondaryPnr, setSecondaryPnr] = useState("");
  const [supplierRef, setSupplierRef] = useState("");
  const [ticketNumbers, setTicketNumbers] = useState<string[]>([]);

  useEffect(() => {
    if (open) {
      setTicketNumbers(passengers.map((p) => p.ticketNumber?.trim() || ""));
    }
  }, [open, passengers]);

  function updateTicketNumber(index: number, value: string) {
    setTicketNumbers((prev) => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (showEticket && !isHotel && passengers.length > 0) {
      const missing = ticketNumbers.some((t) => !t.trim());
      if (missing) {
        toast.error("Enter e-ticket number for each passenger");
        return;
      }
    }

    setLoading(true);

    try {
      const payload: {
        pnr: string;
        secondaryPnr?: string;
        supplierRef?: string;
        ticketNumbers?: string[];
      } = {
        pnr,
        secondaryPnr: secondaryPnr || undefined,
        supplierRef: supplierRef || undefined,
      };

      if (showEticket && !isHotel && passengers.length > 0) {
        payload.ticketNumbers = ticketNumbers.map((t) => t.trim());
      }

      const res = await fetch(`/api/crm/bookings/${bookingId}/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        if (res.status === 401) {
          throw new Error("Session expired or demo access not enabled on this server.");
        }
        throw new Error(data.error || "Failed to confirm");
      }

      toast.success(
        isHotel
          ? "Supplier confirmation saved! Voucher sent to customer."
          : "PNR confirmed! Confirmation email sent to customer."
      );
      setOpen(false);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to confirm PNR");
    } finally {
      setLoading(false);
    }
  }

  const needsEticket = Boolean(showEticket && !isHotel && passengers.length > 0);

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
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {isHotel ? "Supplier Hotel Confirmation" : needsEticket ? "Confirm PNR & E-Ticket" : "Confirm Booking PNR"}
          </DialogTitle>
          <DialogDescription>
            {resume
              ? "PNR was saved but ticket generation failed. Click below to regenerate PDFs and send the PNR confirmation."
              : isHotel
                ? hotelPendingSupplier
                  ? "Enter the hotel supplier confirmation number. This will regenerate the voucher and resend it to the customer."
                  : "Enter the confirmed supplier number from the hotel operator."
                : needsEticket
                  ? "Enter the airline PNR and e-ticket number(s). E-ticket numbers are issued after PNR confirmation. A confirmation email with the updated voucher will be sent to the customer."
                  : "Enter the airline PNR. A separate confirmation email with PNR will be sent. The booking voucher was already emailed when the itinerary was created."}
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

          {needsEticket && (
            <div className="space-y-3 rounded-lg border border-blue-200 bg-blue-50/50 p-4 dark:border-blue-900 dark:bg-blue-950/20">
              <p className="text-sm font-medium text-blue-950 dark:text-blue-100">E-Ticket Numbers *</p>
              <p className="text-xs text-muted-foreground">
                International e-ticket bookings require ticket numbers at PNR confirmation.
              </p>
              {passengers.map((pax, i) => (
                <div key={`${pax.firstName}-${i}`} className="space-y-2">
                  <Label htmlFor={`ticket-${i}`}>E-Ticket - {passengerLabel(pax)}</Label>
                  <Input
                    id={`ticket-${i}`}
                    value={ticketNumbers[i] || ""}
                    onChange={(e) => updateTicketNumber(i, e.target.value)}
                    placeholder="e.g. 0984872349846"
                    required
                  />
                </div>
              ))}
            </div>
          )}

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
            {resume || hotelPendingSupplier
              ? "Regenerate & Send Voucher"
              : isHotel
                ? "Confirm & Send Voucher"
                : needsEticket
                  ? "Confirm PNR & Send E-Ticket"
                  : "Confirm PNR & Send Email"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
