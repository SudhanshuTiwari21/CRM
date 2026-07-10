import { prisma } from "@/lib/db";
import { getEmailLogoInlineAttachment } from "@/lib/email-logo";
import { sendTemplatedEmail, getEmailAttachments } from "@/lib/mailer";
import { generateBookingDocuments, getBookingDocumentPaths } from "./document.service";
import { getBookingCustomerContact } from "@/lib/cash-customer";
import { sendWhatsAppText } from "@/lib/whatsapp";
import {
  buildHotelConfirmedEmailHtml,
} from "@/lib/booking-email-html";
import { buildItineraryVoucherEmailHtml, buildTripcomConfirmedEmailHtml } from "@/lib/tripcom-itinerary-email-html";
import {
  buildBusConfirmedMessage,
  buildFlightConfirmedMessage,
  buildFlightItineraryMessage,
  buildGenericConfirmedMessage,
  buildHotelConfirmedMessage,
} from "@/lib/whatsapp-messages";

async function sendBookingEmail(
  bookingId: string,
  templateKey: "held_processing" | "booking_confirmed" | "itinerary_voucher",
  options?: { documentPaths?: string[]; userId?: string }
) {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: {
      customer: true,
      flightBooking: true,
      hotelBooking: true,
    },
  });
  const agency = await prisma.agencySettings.findUnique({ where: { id: "default" } });

  const contact = booking ? getBookingCustomerContact(booking) : null;
  if (!booking || !contact?.email) return { skipped: true as const };

  const customerForEmail = { ...booking.customer, ...contact };

  const vars = {
    customerName: contact.name,
    publicRef: booking.publicRef,
    productType: booking.productType,
    amount: `₹${Number(booking.totalAmount).toLocaleString("en-IN")}`,
    pnr: booking.pnr || "Pending",
    companyName: agency?.companyName || "Book to Roam",
    companyPhone: agency?.phone || "",
  };

  let htmlOverride: string | undefined;
  if (templateKey === "itinerary_voucher" && booking.flightBooking && agency) {
    htmlOverride = await buildItineraryVoucherEmailHtml({
      agency,
      booking,
      customer: customerForEmail,
      flight: booking.flightBooking,
    });
  } else if (templateKey === "booking_confirmed" && agency) {
    if (booking.productType === "FLIGHT" && booking.flightBooking) {
      htmlOverride = await buildTripcomConfirmedEmailHtml({
        agency,
        booking,
        customer: customerForEmail,
        flight: booking.flightBooking,
      });
    } else if (booking.productType === "HOTEL" && booking.hotelBooking) {
      htmlOverride = buildHotelConfirmedEmailHtml({
        agency,
        booking,
        customer: customerForEmail,
        hotel: booking.hotelBooking,
      });
    }
  }

  let attachments;
  if (templateKey === "booking_confirmed" || templateKey === "itinerary_voucher") {
    let paths = options?.documentPaths ?? (await getBookingDocumentPaths(bookingId, options?.userId));
    attachments = await getEmailAttachments(paths);

    if (paths.length > 0 && attachments.length === 0) {
      const docs = await generateBookingDocuments(bookingId, options?.userId);
      paths = await getBookingDocumentPaths(bookingId, options?.userId);
      if (!paths.length) {
        paths = docs.map((doc) => doc.storagePath);
      }
      attachments = await getEmailAttachments(paths);
    }

    if (attachments.length === 0) {
      throw new Error(
        `Could not attach booking PDFs for ${booking.publicRef}. Regenerate documents and try again.`
      );
    }
  }

  let inlineAttachments;
  if (
    htmlOverride &&
    (templateKey === "booking_confirmed" || templateKey === "itinerary_voucher")
  ) {
    inlineAttachments = [await getEmailLogoInlineAttachment()];
  }

  return sendTemplatedEmail({
    templateKey,
    to: contact.email!,
    vars,
    bookingId,
    attachments,
    inlineAttachments,
    htmlOverride,
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

  const contact = getBookingCustomerContact(booking);

  if (!contact.phone?.trim()) {
    return { success: false, skipped: true, error: "Customer has no phone number - add it on the customer profile." };
  }

  if (!agency) {
    return { success: false, skipped: true, error: "Agency settings not found" };
  }

  let body: string;
  const customerForMsg = { ...booking.customer, ...contact };
  if (booking.productType === "HOTEL" && booking.hotelBooking) {
    body = buildHotelConfirmedMessage({
      agency,
      booking,
      customer: customerForMsg,
      hotel: booking.hotelBooking,
    });
  } else if (booking.productType === "FLIGHT" && booking.flightBooking) {
    body =
      mode === "itinerary"
        ? buildFlightItineraryMessage({
            agency,
            booking,
            customer: customerForMsg,
            flight: booking.flightBooking,
          })
        : buildFlightConfirmedMessage({
            agency,
            booking,
            customer: customerForMsg,
            flight: booking.flightBooking,
          });
  } else if (booking.productType === "BUS" && booking.busBooking) {
    body = buildBusConfirmedMessage({
      agency,
      booking,
      customer: customerForMsg,
      bus: booking.busBooking,
    });
  } else {
    body = buildGenericConfirmedMessage({
      agency,
      booking,
      customer: customerForMsg,
    });
  }

  return sendWhatsAppText({
    to: contact.phone,
    body,
    bookingId,
    template: mode === "itinerary" ? "itinerary_voucher" : "booking_confirmed",
  });
}

/** Send email and WhatsApp. Flight itinerary voucher on create; PNR confirmation after confirm. */
export async function sendBookingNotifications(
  bookingId: string,
  templateKey: "held_processing" | "booking_confirmed" | "itinerary_voucher",
  options?: { documentPaths?: string[]; userId?: string }
) {
  const emailResult = await sendBookingEmail(bookingId, templateKey, options);

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
