"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Mail, FileText } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { BookingStatus } from "@prisma/client";

interface BookingActionsProps {
  bookingId: string;
  status: BookingStatus;
}

export function BookingActions({ bookingId, status }: BookingActionsProps) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);

  async function handleAction(action: "resend" | "regenerate") {
    setLoading(action);
    try {
      const endpoint =
        action === "resend"
          ? `/api/crm/bookings/${bookingId}/resend-email`
          : `/api/crm/bookings/${bookingId}/regenerate-docs`;

      const res = await fetch(endpoint, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      toast.success(action === "resend" ? "Email & WhatsApp resent" : "Documents regenerated");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Action failed");
    } finally {
      setLoading(null);
    }
  }

  if (!["CONFIRMED", "TICKET_SENT", "PROCESSING"].includes(status)) return null;

  return (
    <div className="flex gap-2">
      <Button
        variant="outline"
        size="sm"
        disabled={!!loading}
        onClick={() => handleAction("resend")}
      >
        {loading === "resend" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Mail className="mr-2 h-4 w-4" />}
        Resend Email & WhatsApp
      </Button>
      {["CONFIRMED", "TICKET_SENT"].includes(status) && (
        <Button
          variant="outline"
          size="sm"
          disabled={!!loading}
          onClick={() => handleAction("regenerate")}
        >
          {loading === "regenerate" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileText className="mr-2 h-4 w-4" />}
          Regenerate Docs
        </Button>
      )}
    </div>
  );
}
