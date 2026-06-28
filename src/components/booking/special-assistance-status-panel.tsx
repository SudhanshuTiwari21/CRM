"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { FormSettingToggle } from "@/components/booking/edit-form-section";
import { bookingNeedsSpecialAssistance } from "@/lib/special-assistance";
import type { FlightPassenger } from "@/types/booking";

interface SpecialAssistanceStatusPanelProps {
  bookingId: string;
  passengers: FlightPassenger[];
  updatedToAirline: boolean;
}

export function SpecialAssistanceStatusPanel({
  bookingId,
  passengers,
  updatedToAirline,
}: SpecialAssistanceStatusPanelProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState(updatedToAirline);

  if (!bookingNeedsSpecialAssistance(passengers)) {
    return (
      <div className="rounded-lg border bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
        No special assistance requested on this booking.
      </div>
    );
  }

  async function handleToggle(checked: boolean) {
    setLoading(true);
    try {
      const res = await fetch(`/api/crm/bookings/${bookingId}/special-assistance`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ specialAssistanceUpdatedToAirline: checked }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Update failed");
      setStatus(checked);
      toast.success(checked ? "Marked as updated to airline" : "Marked as not updated");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Update failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-3 rounded-lg border border-violet-200 bg-violet-50/50 p-4 dark:border-violet-900 dark:bg-violet-950/20">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-medium">Special assistance updated to airline</p>
          <p className="text-xs text-muted-foreground">
            Track whether wheelchair / assistance requests are saved with the airline.
          </p>
        </div>
        <Badge variant={status ? "success" : "warning"}>{status ? "Yes" : "No"}</Badge>
      </div>
      <FormSettingToggle
        label="Updated to airline"
        description="Turn on once assistance is confirmed with the airline"
        checked={status}
        onCheckedChange={handleToggle}
        disabled={loading}
      />
      {loading && <p className="text-xs text-muted-foreground">Saving...</p>}
    </div>
  );
}
