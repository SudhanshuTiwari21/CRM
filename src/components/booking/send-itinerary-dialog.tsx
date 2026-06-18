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

interface SendItineraryDialogProps {
  bookingId: string;
  isRoundTrip?: boolean;
  trigger?: React.ReactNode;
}

export function SendItineraryDialog({ bookingId, isRoundTrip, trigger }: SendItineraryDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [pnr, setPnr] = useState("");
  const [secondaryPnr, setSecondaryPnr] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch(`/api/crm/bookings/${bookingId}/send-itinerary`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pnr, secondaryPnr: secondaryPnr || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to send itinerary");
      toast.success("Itinerary sent to customer");
      setOpen(false);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to send itinerary");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || <Button variant="outline" size="sm">Send Itinerary</Button>}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Send Itinerary</DialogTitle>
          <DialogDescription>
            Enter PNR to generate ticket & invoice and email the customer.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>PNR *</Label>
            <Input
              value={pnr}
              onChange={(e) => setPnr(e.target.value.toUpperCase())}
              placeholder="e.g. F8HZQY"
              required
            />
          </div>
          {isRoundTrip && (
            <div className="space-y-2">
              <Label>Return PNR (optional)</Label>
              <Input
                value={secondaryPnr}
                onChange={(e) => setSecondaryPnr(e.target.value.toUpperCase())}
                placeholder="Return leg PNR"
              />
            </div>
          )}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Send Itinerary & Documents
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
