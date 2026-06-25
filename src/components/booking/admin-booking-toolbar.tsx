"use client";

import { useSession } from "next-auth/react";
import type { Customer, FlightBooking } from "@prisma/client";
import { BookingActions } from "@/components/booking/booking-actions";
import { EditBookingDialog } from "@/components/booking/edit-booking-dialog";
import { DeleteBookingDialog } from "@/components/booking/delete-booking-dialog";
import type { BookingStatus } from "@prisma/client";

interface AdminBookingToolbarProps {
  bookingId: string;
  publicRef: string;
  productType: string;
  status: BookingStatus;
  pnr?: string | null;
  internalNotes?: string | null;
  totalAmount: number;
  customer?: Pick<Customer, "gstin" | "state">;
  flight?: FlightBooking | null;
}

export function AdminBookingToolbar(props: AdminBookingToolbarProps) {
  const { data: session } = useSession();
  const isAdmin = session?.user?.role === "ADMIN";

  return (
    <div className="flex flex-wrap gap-2">
      {isAdmin && (
        <>
          <EditBookingDialog
            bookingId={props.bookingId}
            productType={props.productType}
            pnr={props.pnr}
            internalNotes={props.internalNotes}
            totalAmount={props.totalAmount}
            customer={props.customer}
            flight={props.flight}
          />
          <DeleteBookingDialog bookingId={props.bookingId} publicRef={props.publicRef} />
        </>
      )}
      {isAdmin && <BookingActions bookingId={props.bookingId} status={props.status} />}
    </div>
  );
}
