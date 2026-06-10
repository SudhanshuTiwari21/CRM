"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/booking/status-badge";
import { PRODUCT_LABELS, CHANNEL_LABELS } from "@/lib/constants";
import { formatCurrency } from "@/lib/utils";
import type { BookingStatus } from "@prisma/client";

const KANBAN_COLUMNS: BookingStatus[] = ["PROCESSING", "CONFIRMED", "TICKET_SENT", "FAILED"];

interface KanbanBooking {
  id: string;
  publicRef: string;
  status: BookingStatus;
  productType: string;
  channel: string;
  totalAmount: string | number;
  pnr: string | null;
  customer: { name: string };
}

export function BookingsKanban() {
  const [bookings, setBookings] = useState<KanbanBooking[]>([]);

  useEffect(() => {
    fetch("/api/crm/bookings?view=kanban")
      .then((r) => r.json())
      .then((d) => setBookings(d.bookings || []));
  }, []);

  const grouped = KANBAN_COLUMNS.reduce(
    (acc, status) => {
      acc[status] = bookings.filter((b) => b.status === status);
      return acc;
    },
    {} as Record<BookingStatus, KanbanBooking[]>
  );

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {KANBAN_COLUMNS.map((status) => (
        <div key={status} className="space-y-3">
          <div className="flex items-center gap-2">
            <StatusBadge status={status} />
            <Badge variant="secondary">{grouped[status]?.length || 0}</Badge>
          </div>
          <div className="space-y-2">
            {(grouped[status] || []).map((booking) => (
              <Link key={booking.id} href={`/bookings/${booking.id}`}>
                <Card className="cursor-pointer transition-shadow hover:shadow-md">
                  <CardHeader className="p-4 pb-2">
                    <CardTitle className="text-sm font-semibold">{booking.publicRef}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 p-4 pt-0">
                    <p className="text-sm">{booking.customer.name}</p>
                    <div className="flex flex-wrap gap-1">
                      <Badge variant="outline" className="text-xs">
                        {PRODUCT_LABELS[booking.productType as keyof typeof PRODUCT_LABELS]}
                      </Badge>
                      <Badge variant="outline" className="text-xs">
                        {CHANNEL_LABELS[booking.channel as keyof typeof CHANNEL_LABELS]}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>{booking.pnr || "No PNR"}</span>
                      <span className="font-medium text-foreground">{formatCurrency(booking.totalAmount)}</span>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
