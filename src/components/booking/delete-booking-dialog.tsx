"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Trash2 } from "lucide-react";
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

interface DeleteBookingDialogProps {
  bookingId: string;
  publicRef: string;
}

export function DeleteBookingDialog({ bookingId, publicRef }: DeleteBookingDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [confirmText, setConfirmText] = useState("");

  async function handleDelete() {
    if (confirmText !== publicRef) {
      toast.error("Type the booking ID exactly to confirm");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/crm/bookings/${bookingId}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Delete failed");

      toast.success(`Deleted ${publicRef}. Later bookings renumbered for GST serial continuity.`);
      setOpen(false);
      router.push("/bookings");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Delete failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="destructive" size="sm">
          <Trash2 className="mr-2 h-4 w-4" />
          Delete
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete booking {publicRef}?</DialogTitle>
          <DialogDescription>
            This permanently removes the booking, invoice, and voucher. Later bookings in the same year
            will be renumbered to keep serial numbers gap-free for GST compliance.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2 py-2">
          <Label>
            Type <span className="font-mono font-medium">{publicRef}</span> to confirm
          </Label>
          <Input value={confirmText} onChange={(e) => setConfirmText(e.target.value)} placeholder={publicRef} />
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setOpen(false)} disabled={loading}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={loading || confirmText !== publicRef}
          >
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Delete permanently
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
