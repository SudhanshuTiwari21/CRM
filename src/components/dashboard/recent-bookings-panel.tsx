import Link from "next/link";
import { StatusBadge } from "@/components/booking/status-badge";
import { PRODUCT_LABELS, CHANNEL_LABELS } from "@/lib/constants";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import type { BookingChannel, BookingStatus, ProductType } from "@prisma/client";

interface RecentBooking {
  id: string;
  publicRef: string;
  status: BookingStatus;
  channel: BookingChannel;
  productType: ProductType;
  totalAmount: number | string | { toString(): string };
  createdAt: Date;
  customer: { name: string };
}

export function RecentBookingsPanel({ bookings }: { bookings: RecentBooking[] }) {
  return (
    <div className="rounded-xl border bg-card shadow-sm">
      <div className="flex items-center justify-between border-b px-5 py-4">
        <div>
          <h3 className="font-semibold tracking-tight">Recent Bookings</h3>
          <p className="text-xs text-muted-foreground">Latest activity across all channels</p>
        </div>
        <Link
          href="/bookings"
          className="text-xs font-medium text-primary hover:underline"
        >
          View all →
        </Link>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/30 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <th className="px-5 py-3">Booking</th>
              <th className="px-3 py-3 hidden sm:table-cell">Customer</th>
              <th className="px-3 py-3 hidden md:table-cell">Product</th>
              <th className="px-3 py-3">Status</th>
              <th className="px-5 py-3 text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {bookings.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-5 py-10 text-center text-muted-foreground">
                  No bookings yet
                </td>
              </tr>
            ) : (
              bookings.map((b) => (
                <tr
                  key={b.id}
                  className="border-b last:border-0 transition-colors hover:bg-muted/30"
                >
                  <td className="px-5 py-3">
                    <Link
                      href={`/bookings/${b.id}`}
                      className="font-semibold text-primary hover:underline"
                    >
                      {b.publicRef}
                    </Link>
                    <p className="text-xs text-muted-foreground sm:hidden">{b.customer.name}</p>
                    <p className="text-xs text-muted-foreground">{formatDateTime(b.createdAt)}</p>
                  </td>
                  <td className="hidden px-3 py-3 sm:table-cell">{b.customer.name}</td>
                  <td className="hidden px-3 py-3 md:table-cell">
                    <span className="text-muted-foreground">
                      {PRODUCT_LABELS[b.productType]} · {CHANNEL_LABELS[b.channel]}
                    </span>
                  </td>
                  <td className="px-3 py-3">
                    <StatusBadge status={b.status} />
                  </td>
                  <td className="px-5 py-3 text-right font-semibold tabular-nums">
                    {formatCurrency(b.totalAmount)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
