import { Badge } from "@/components/ui/badge";
import { BOOKING_STATUS_LABELS, BOOKING_STATUS_VARIANT } from "@/lib/constants";
import type { BookingStatus } from "@prisma/client";

export function StatusBadge({ status }: { status: BookingStatus }) {
  return (
    <Badge variant={BOOKING_STATUS_VARIANT[status]}>
      {BOOKING_STATUS_LABELS[status]}
    </Badge>
  );
}
