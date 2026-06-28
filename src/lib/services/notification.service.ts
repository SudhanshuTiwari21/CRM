import { prisma } from "@/lib/db";
import { sendTemplatedEmail, getEmailAttachments } from "@/lib/mailer";
import { getBookingDocumentPaths } from "./document.service";
import { sendWhatsAppText } from "@/lib/whatsapp";
import {
  buildBusConfirmedMessage,
  buildFlightConfirmedMessage,
  buildFlightItineraryMessage,
  buildGenericConfirmedMessage,
  buildHotelConfirmedMessage,
} from "@/lib/whatsapp-messages";

async function sendBookingEmail(
  bookingId: string,
  templateKey: "held_processing" | "booking_confirmed" | "itinerary_voucher"
) {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { customer: true },
  });
  const agency = await prisma.agencySettings.findUnique({ where: { id: "default" } });

  if (!booking?.customer.email) return { skipped: true as const };

  const vars = {
    customerName: booking.customer.name,
    publicRef: booking.publicRef,
    productType: booking.productType,
    amount: `₹${Number(booking.totalAmount).toLocaleString("en-IN")}`,
    pnr: booking.pnr || "Pending",
    companyName: agency?.companyName || "Book to Roam",
    companyPhone: agency?.phone || "",
  };

  let attachments;
  if (templateKey === "booking_confirmed" || templateKey === "itinerary_voucher") {
    const paths = await getBookingDocumentPaths(bookingId);
    attachments = await getEmailAttachments(paths);
  }

  return sendTemplatedEmail({
    templateKey,
    to: booking.customer.email,
    vars,
    bookingId,
    attachments,
  });
}

async function sendBookingWhatsApp(
  bookingId: string,
  mode: "confirmed" | "itinerary" = "confirmed"
) {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: {
      customer: true,
      flightBooking: true,
      hotelBooking: true,
      busBooking: true,
    },
  });
  const agency = await prisma.agencySettings.findUnique({ where: { id: "default" } });

  if (!booking) {
    return { success: false, skipped: true, error: "Booking not found" };
  }

  if (!booking.customer.phone?.trim()) {
    return { success: false, skipped: true, error: "Customer has no phone number — add it on the customer profile." };
  }

  if (!agency) {
    return { success: false, skipped: true, error: "Agency settings not found" };
  }

  let body: string;
  if (booking.productType === "HOTEL" && booking.hotelBooking) {
    body = buildHotelConfirmedMessage({
      agency,
      booking,
      customer: booking.customer,
      hotel: booking.hotelBooking,
    });
  } else if (booking.productType === "FLIGHT" && booking.flightBooking) {
    body =
      mode === "itinerary"
        ? buildFlightItineraryMessage({
            agency,
            booking,
            customer: booking.customer,
            flight: booking.flightBooking,
          })
        : buildFlightConfirmedMessage({
            agency,
            booking,
            customer: booking.customer,
            flight: booking.flightBooking,
          });
  } else if (booking.productType === "BUS" && booking.busBooking) {
    body = buildBusConfirmedMessage({
      agency,
      booking,
      customer: booking.customer,
      bus: booking.busBooking,
    });
  } else {
    body = buildGenericConfirmedMessage({
      agency,
      booking,
      customer: booking.customer,
    });
  }

  return sendWhatsAppText({
    to: booking.customer.phone,
    body,
    bookingId,
    template: mode === "itinerary" ? "itinerary_voucher" : "booking_confirmed",
  });
}

/** Send email and WhatsApp. Flight itinerary voucher on create; PNR confirmation after confirm. */
export async function sendBookingNotifications(
  bookingId: string,
  templateKey: "held_processing" | "booking_confirmed" | "itinerary_voucher"
) {
  const emailResult = await sendBookingEmail(bookingId, templateKey);

  let whatsappResult:
    | { success: boolean; skipped?: boolean; error?: string }
    | { skipped: true; reason: string }
    | undefined;

  if (templateKey === "booking_confirmed") {
    whatsappResult = await sendBookingWhatsApp(bookingId, "confirmed");
  } else if (templateKey === "itinerary_voucher") {
    whatsappResult = await sendBookingWhatsApp(bookingId, "itinerary");
  } else {
    whatsappResult = { skipped: true, reason: "WhatsApp is only sent for flight vouchers and confirmed bookings." };
  }

  return { email: emailResult, whatsapp: whatsappResult };
}
