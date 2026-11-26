import { format } from "date-fns";
import { prisma } from "@/lib/db";
import { getAgencySettings } from "@/lib/brand-context";
import { sendEmail, getEmailAttachments } from "@/lib/mailer";
import { getBookingCustomerContact, formatBillingAddress } from "@/lib/cash-customer";
import { MEAL_PLAN_LABELS } from "@/lib/constants/hotel";
import { logActivity } from "@/lib/services/activity.service";
import { generateBookingDocuments } from "@/lib/services/document.service";
import type { HotelGuest } from "@/types/booking";

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function guestNames(guests: unknown): string {
  if (!Array.isArray(guests)) return "";
  return (guests as HotelGuest[])
    .map((g) => g.name?.trim())
    .filter(Boolean)
    .join(", ");
}

function detailRow(label: string, value: string) {
  if (!value.trim()) return "";
  return `<div style="margin-top:10px;font-size:13px;color:#6b7280;">${escapeHtml(label)}</div>
          <div style="font-weight:600;color:#111827;">${escapeHtml(value)}</div>`;
}

function buildHotelExtraServicesEmailHtml(params: {
  companyName: string;
  companyPhone?: string | null;
  propertyName: string;
  publicRef: string;
  confirmationNo: string;
  guestName: string;
  guestPhone: string;
  guestEmail: string;
  guestAddress: string;
  guestsList: string;
  checkInLabel: string;
  checkOutLabel: string;
  checkInTime: string;
  checkOutTime: string;
  nights: number;
  roomsCount: number;
  roomType: string;
  mealPlan: string;
  adultsCount: number;
  childrenCount: number;
  extraServicesNotes: string | null;
}) {
  const notesBlock = params.extraServicesNotes?.trim()
    ? `<div style="margin-top:16px;padding:16px;border-radius:8px;background:#fff7ed;border:1px solid #fdba74;">
        <div style="font-size:12px;font-weight:700;letter-spacing:0.04em;text-transform:uppercase;color:#c2410c;">Requested extra services</div>
        <div style="margin-top:8px;white-space:pre-wrap;font-size:15px;line-height:1.6;color:#9a3412;">${escapeHtml(params.extraServicesNotes.trim())}</div>
      </div>`
    : `<p style="margin:16px 0 0;color:#9a3412;font-size:14px;">Extra services were opted — details may follow from ${escapeHtml(params.companyName)}.</p>`;

  const occupancy = [
    `${params.adultsCount} adult${params.adultsCount === 1 ? "" : "s"}`,
    params.childrenCount > 0
      ? `${params.childrenCount} child${params.childrenCount === 1 ? "" : "ren"}`
      : null,
  ]
    .filter(Boolean)
    .join(", ");

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /></head>
<body style="margin:0;padding:0;background:#f4f6f8;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f8;padding:24px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;">
          <tr>
            <td style="background:#9a3412;padding:20px 32px;">
              <h1 style="margin:0;color:#ffffff;font-size:18px;font-weight:600;">Extra services request</h1>
              <p style="margin:4px 0 0;color:#fed7aa;font-size:12px;">${escapeHtml(params.companyName)}</p>
            </td>
          </tr>
          <tr>
            <td style="padding:28px 32px;color:#1f2937;font-size:15px;line-height:1.6;">
              <p style="margin:0 0 12px;">Dear <strong>${escapeHtml(params.propertyName)}</strong> reservations team,</p>
              <p style="margin:0 0 16px;">
                A guest booking through <strong>${escapeHtml(params.companyName)}</strong> has requested extra services.
                Please arrange as noted below. The hotel voucher PDF is attached for reference.
              </p>
              <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e7eb;border-radius:10px;margin-bottom:12px;">
                <tr>
                  <td style="padding:16px 20px;background:#fff7ed;">
                    <div style="font-size:12px;font-weight:700;letter-spacing:0.04em;text-transform:uppercase;color:#c2410c;">Hotel confirmation no.</div>
                    <div style="margin-top:6px;font-size:22px;font-weight:700;color:#9a3412;">${escapeHtml(params.confirmationNo)}</div>
                    <div style="margin-top:8px;font-size:13px;color:#6b7280;">CRM booking ref: <strong style="color:#111827;">${escapeHtml(params.publicRef)}</strong></div>
                  </td>
                </tr>
              </table>
              <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e7eb;border-radius:10px;">
                <tr>
                  <td style="padding:16px 20px;">
                    ${detailRow("Guest / booker", params.guestName)}
                    ${detailRow("Phone", params.guestPhone)}
                    ${detailRow("Email", params.guestEmail)}
                    ${detailRow("Billing address", params.guestAddress)}
                    ${detailRow("All guests on voucher", params.guestsList)}
                    ${detailRow(
                      "Stay",
                      `Check-in ${params.checkInLabel} (${params.checkInTime}) · Check-out ${params.checkOutLabel} (${params.checkOutTime}) · ${params.nights} night${params.nights === 1 ? "" : "s"}`
                    )}
                    ${detailRow("Room", `${params.roomsCount} × ${params.roomType}`)}
                    ${detailRow("Occupancy", occupancy)}
                    ${detailRow("Meal plan", params.mealPlan)}
                  </td>
                </tr>
              </table>
              ${notesBlock}
              <p style="margin:20px 0 0;font-size:13px;color:#6b7280;">
                Please confirm arrangement with ${escapeHtml(params.companyName)}
                ${params.companyPhone ? ` (${escapeHtml(params.companyPhone)})` : ""}.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export type HotelExtraServicesNotifyResult =
  | { skipped: true; reason: string }
  | { success: true; to: string; emailLogId: string }
  | { success: false; to: string; error: string; emailLogId?: string };

/**
 * Email the booking's reservations address when extra services are opted.
 * Attaches the hotel voucher PDF. Marks CRM "notified to hotel" on success.
 *
 * Auto confirm flow should pass `requireRequestedAtCreate: true` so mail only
 * goes out when Extra Services was Yes at booking creation (not if added later).
 */
export async function notifyHotelExtraServices(
  bookingId: string,
  options?: { userId?: string; force?: boolean; requireRequestedAtCreate?: boolean }
): Promise<HotelExtraServicesNotifyResult> {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: {
      customer: true,
      hotelBooking: true,
      documents: true,
    },
  });

  if (!booking?.hotelBooking) {
    return { skipped: true, reason: "Not a hotel booking" };
  }

  const hotel = booking.hotelBooking;
  if (!hotel.extraServicesOpted) {
    return { skipped: true, reason: "No extra services opted" };
  }

  if (options?.requireRequestedAtCreate && !hotel.extraServicesRequestedAtCreate) {
    return {
      skipped: true,
      reason: "Extra services were not requested at booking create — auto email skipped",
    };
  }

  if (hotel.extraServicesNotifiedToHotel && !options?.force) {
    return { skipped: true, reason: "Hotel already notified" };
  }

  const reservationsEmail = hotel.extraServicesReservationsEmail?.trim() || "";
  if (!reservationsEmail) {
    return {
      skipped: true,
      reason: "No reservations email on this booking — add it under Extra Services",
    };
  }

  let voucherDoc = booking.documents.find((d) => d.type === "VOUCHER");
  if (!voucherDoc) {
    await generateBookingDocuments(bookingId, options?.userId);
    voucherDoc = await prisma.document.findFirst({
      where: { bookingId, type: "VOUCHER" },
    });
  }

  if (!voucherDoc) {
    return { skipped: true, reason: "Hotel voucher not available" };
  }

  let attachments = await getEmailAttachments([voucherDoc.storagePath]);
  if (attachments.length === 0) {
    await generateBookingDocuments(bookingId, options?.userId);
    const refreshed = await prisma.document.findFirst({
      where: { bookingId, type: "VOUCHER" },
    });
    if (!refreshed) {
      return { skipped: true, reason: "Could not attach hotel voucher" };
    }
    attachments = await getEmailAttachments([refreshed.storagePath]);
    if (attachments.length === 0) {
      return { skipped: true, reason: "Could not attach hotel voucher" };
    }
  }

  const agency = await getAgencySettings();
  const companyName = agency?.companyName || "Book to Roam";
  const contact = getBookingCustomerContact(booking);
  const confirmationNo = hotel.confirmationNo || booking.pnr || "Pending";
  const to = reservationsEmail;
  const guestEmail = (contact.email || booking.customer.email || "").trim();
  const cc =
    guestEmail && guestEmail.toLowerCase() !== reservationsEmail.toLowerCase()
      ? guestEmail
      : undefined;

  const html = buildHotelExtraServicesEmailHtml({
    companyName,
    companyPhone: agency?.phone,
    propertyName: hotel.propertyName,
    publicRef: booking.publicRef,
    confirmationNo,
    guestName: contact.name || booking.customer.name,
    guestPhone: contact.phone || booking.customer.phone || "",
    guestEmail,
    guestAddress: formatBillingAddress(contact) || formatBillingAddress(booking.customer),
    guestsList: guestNames(hotel.guests),
    checkInLabel: format(new Date(hotel.checkIn), "MMM d, yyyy"),
    checkOutLabel: format(new Date(hotel.checkOut), "MMM d, yyyy"),
    checkInTime: hotel.checkInTime,
    checkOutTime: hotel.checkOutTime,
    nights: hotel.nights,
    roomsCount: hotel.roomsCount,
    roomType: hotel.roomType,
    mealPlan: MEAL_PLAN_LABELS[hotel.mealPlan] || hotel.mealPlan,
    adultsCount: hotel.adultsCount,
    childrenCount: hotel.childrenCount,
    extraServicesNotes: hotel.extraServicesNotes,
  });

  const result = await sendEmail({
    to,
    cc,
    subject: `Extra services · Conf ${confirmationNo} · ${hotel.propertyName} · ${booking.publicRef}`,
    html,
    bookingId,
    template: "hotel_extra_services",
    attachments,
  });

  if (result.success) {
    await prisma.hotelBooking.update({
      where: { bookingId },
      data: {
        extraServicesNotifiedToHotel: true,
        extraServicesNotifiedAt: new Date(),
      },
    });
    try {
      await logActivity({
        bookingId,
        userId: options?.userId && options.userId !== "bypass" ? options.userId : undefined,
        action: "EXTRA_SERVICES_HOTEL_EMAILED",
        details: {
          to: [reservationsEmail],
          cc: cc ? [cc] : [],
          emailLogId: result.emailLogId,
          confirmationNo,
        },
      });
    } catch {
      // non-critical
    }
    return { success: true, to, emailLogId: result.emailLogId };
  }

  return {
    success: false,
    to,
    error: result.error || "Failed to email hotel",
    emailLogId: result.emailLogId,
  };
}
