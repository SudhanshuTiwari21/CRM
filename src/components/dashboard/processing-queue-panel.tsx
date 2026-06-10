import Link from "next/link";
import { Clock, ChevronRight, AlertTriangle, Plane, Building2, Bus } from "lucide-react";
import { StatusBadge } from "@/components/booking/status-badge";
import { CHANNEL_LABELS, PRODUCT_LABELS } from "@/lib/constants";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import type { BookingChannel, BookingStatus, ProductType } from "@prisma/client";
import { Button } from "@/components/ui/button";

interface QueueItem {
  id: string;
  publicRef: string;
  status: BookingStatus;
  channel: BookingChannel;
  productType: ProductType;
  totalAmount: number | string | { toString(): string };
  pnr: string | null;
  createdAt: Date;
  customer: { name: string };
}

interface ProcessingQueuePanelProps {
  items: QueueItem[];
  total: number;
}

const productIcons = {
  FLIGHT: Plane,
  HOTEL: Building2,
  BUS: Bus,
};

function hoursWaiting(createdAt: Date) {
  return Math.floor((Date.now() - new Date(createdAt).getTime()) / (1000 * 60 * 60));
}

export function ProcessingQueuePanel({ items, total }: ProcessingQueuePanelProps) {
  return (
    <div className="flex h-full flex-col rounded-xl border bg-card shadow-sm">
      <div className="flex items-center justify-between border-b px-5 py-4">
        <div>
          <h3 className="font-semibold tracking-tight">Action Required</h3>
          <p className="text-xs text-muted-foreground">Awaiting PNR & confirmation</p>
        </div>
        {total > 0 && (
          <span className="flex h-7 min-w-7 items-center justify-center rounded-full bg-amber-500 px-2 text-xs font-bold text-white">
            {total}
          </span>
        )}
      </div>

      <div className="flex-1 space-y-2 p-3">
        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/10">
              <Clock className="h-6 w-6 text-emerald-600" />
            </div>
            <p className="font-medium text-emerald-700">Queue clear</p>
            <p className="mt-1 text-xs text-muted-foreground">No bookings pending PNR</p>
          </div>
        ) : (
          items.map((booking) => {
            const hours = hoursWaiting(booking.createdAt);
            const urgent = hours >= 24;
            const ProductIcon = productIcons[booking.productType];

            return (
              <Link
                key={booking.id}
                href={`/bookings/${booking.id}`}
                className={`group block rounded-lg border p-3 transition-all hover:border-primary/30 hover:bg-muted/40 hover:shadow-sm ${
                  urgent ? "border-amber-300/60 bg-amber-50/50 dark:bg-amber-950/20" : ""
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <ProductIcon className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="font-semibold tracking-tight">{booking.publicRef}</p>
                      <p className="text-sm text-muted-foreground">{booking.customer.name}</p>
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <StatusBadge status={booking.status} />
                  <span className="rounded-md bg-muted px-2 py-0.5 text-xs font-medium">
                    {PRODUCT_LABELS[booking.productType]}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {CHANNEL_LABELS[booking.channel]}
                  </span>
                </div>

                <div className="mt-2 flex items-center justify-between text-xs">
                  <span className="font-semibold text-foreground">
                    {formatCurrency(booking.totalAmount)}
                  </span>
                  <span
                    className={`flex items-center gap-1 ${
                      urgent ? "font-medium text-amber-700" : "text-muted-foreground"
                    }`}
                  >
                    {urgent && <AlertTriangle className="h-3 w-3" />}
                    {hours < 1 ? "Just now" : `${hours}h waiting`}
                  </span>
                </div>
              </Link>
            );
          })
        )}
      </div>

      {total > items.length && (
        <div className="border-t p-3">
          <Button variant="ghost" size="sm" className="w-full" asChild>
            <Link href="/bookings?status=PROCESSING">
              View all {total} in queue
              <ChevronRight className="ml-1 h-4 w-4" />
            </Link>
          </Button>
        </div>
      )}
    </div>
  );
}
