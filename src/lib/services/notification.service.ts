import { prisma } from "@/lib/db";
import { sendTemplatedEmail, getEmailAttachments } from "@/lib/mailer";
import { getBookingDocumentPaths } from "./document.service";
import { sendWhatsAppText } from "@/lib/whatsapp";
import {
  buildBusConfirmedMessage,
  buildFlightConfirmedMessage,
  buildGenericConfirmedMessage,
  buildHotelConfirmedMessage,
} from "@/lib/whatsapp-messages";

async function sendBookingEmail(
  bookingId: string,
  templateKey: "held_processing" | "booking_confirmed"
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
  if (templateKey === "booking_confirmed") {
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

async function sendBookingWhatsApp(bookingId: string) {
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

  if (!booking?.customer.phone?.trim() || !agency) {
    return { skipped: true as const };
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
    body = buildFlightConfirmedMessage({
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
    template: "booking_confirmed",
  });
}

/** Send email and WhatsApp in parallel. WhatsApp only on confirmed bookings. */
export async function sendBookingNotifications(
  bookingId: string,
  templateKey: "held_processing" | "booking_confirmed"
) {
  const tasks: Promise<unknown>[] = [sendBookingEmail(bookingId, templateKey)];

  if (templateKey === "booking_confirmed") {
    tasks.push(sendBookingWhatsApp(bookingId));
  }

  const results = await Promise.allSettled(tasks);
  return results;
}
