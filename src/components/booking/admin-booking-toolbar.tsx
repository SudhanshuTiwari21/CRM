"use client";

import { useSession } from "next-auth/react";
import type { BookingStatus, CancellationCategory, FlightBooking, HotelBooking, ProductType } from "@prisma/client";
import type { BookingCustomerContact } from "@/lib/cash-customer";
import { BookingActions } from "@/components/booking/booking-actions";
import { EditBookingDialog } from "@/components/booking/edit-booking-dialog";
import { DeleteBookingDialog } from "@/components/booking/delete-booking-dialog";
import { CancelBookingDialog } from "@/components/booking/cancel-booking-dialog";

interface AdminBookingToolbarProps {
  bookingId: string;
  publicRef: string;
  productType: ProductType;
  status: BookingStatus;
  paymentStatus: string;
  pnr?: string | null;
  internalNotes?: string | null;
  totalAmount: number;
  cancellationCategory?: CancellationCategory;
  creditEnabled?: boolean;
  billingType: string;
  customerContact: BookingCustomerContact;
  flight?: FlightBooking | null;
  hotel?: HotelBooking | null;
}

export function AdminBookingToolbar(props: AdminBookingToolbarProps) {
  const { data: session } = useSession();
  const isAdmin = session?.user?.role === "ADMIN";
  const showCancel =
    isAdmin &&
    props.cancellationCategory &&
    (props.productType === "FLIGHT" || props.productType === "HOTEL");

  return (
    <div className="flex flex-wrap gap-2">
      {isAdmin && (
        <>
          <EditBookingDialog
            bookingId={props.bookingId}
            productType={props.productType}
            paymentStatus={props.paymentStatus}
            billingType={props.billingType}
            customerContact={props.customerContact}
            pnr={props.pnr}
            internalNotes={props.internalNotes}
            totalAmount={props.totalAmount}
            flight={props.flight}
            hotel={props.hotel}
          />
          {showCancel && (
            <CancelBookingDialog
              bookingId={props.bookingId}
              publicRef={props.publicRef}
              productType={props.productType}
              status={props.status}
              totalAmount={props.totalAmount}
              category={props.cancellationCategory!}
              creditEnabled={props.creditEnabled}
            />
          )}
          <DeleteBookingDialog bookingId={props.bookingId} publicRef={props.publicRef} />
        </>
      )}
      {isAdmin && <BookingActions bookingId={props.bookingId} status={props.status} />}
    </div>
  );
}
