import { prisma } from "@/lib/db";
import { sendEmail } from "@/lib/mailer";
import { sendWhatsAppText } from "@/lib/whatsapp";
import {
  getEarliestDeparture,
  hoursUntilDeparture,
  isDueForCheckInAssistanceNotification,
} from "@/lib/flight-departure";
import { buildSectorSummary } from "@/lib/flight-layover";
import { formatDateTime } from "@/lib/utils";
import type { FlightSegment } from "@/types/booking";

function buildAdminCheckInMessage(params: {
  companyName: string;
  publicRef: string;
  customerName: string;
  customerPhone: string;
  pnr: string;
  airline: string;
  sector: string;
  departureAt: Date;
  hoursLeft: number;
}) {
  const { companyName, publicRef, customerName, customerPhone, pnr, airline, sector, departureAt, hoursLeft } =
    params;

  return `*${companyName} — Check-in Assistance Reminder*

Booking: *${publicRef}*
Customer: ${customerName} (${customerPhone})
PNR: ${pnr || "Pending"}
Airline: ${airline}
Sector: ${sector}
Departure: ${formatDateTime(departureAt)}
Time until departure: ~${hoursLeft}h

This booking is flagged for *check-in booking assistance*. Please follow up with the customer.`;
}

export async function sendCheckInAssistanceAdminAlert(bookingId: string) {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { customer: true, flightBooking: true },
  });

  if (!booking?.flightBooking?.checkInAssistance) {
    return { skipped: true, reason: "Check-in assistance not enabled" };
  }

  if (booking.flightBooking.checkInAssistanceNotifiedAt) {
    return { skipped: true, reason: "Already notified" };
  }

  const segments = booking.flightBooking.segments as unknown as FlightSegment[];
  const departure =
    booking.flightBooking.earliestDepartureAt || getEarliestDeparture(segments);

  if (!departure || departure <= new Date()) {
    return { skipped: true, reason: "No upcoming departure" };
  }

  if (!isDueForCheckInAssistanceNotification(departure)) {
    return { skipped: true, reason: "Not yet within 48-hour window" };
  }

  const agency = await prisma.agencySettings.findUnique({ where: { id: "default" } });
  const companyName = agency?.companyName || "Book to Roam";
  const hoursLeft = hoursUntilDeparture(departure);
  const sector = buildSectorSummary(segments, booking.flightBooking.tripType);
  const vars = {
    companyName,
    publicRef: booking.publicRef,
    customerName: booking.customer.name,
    customerPhone: booking.customer.phone,
    pnr: booking.pnr || "Pending",
    airline: booking.flightBooking.airline,
    sector,
    departureAt: formatDateTime(departure),
    hoursLeft: String(hoursLeft),
  };

  const results: { email?: unknown; whatsapp?: unknown } = {};

  if (agency?.email) {
    results.email = await sendEmail({
      to: agency.email,
      subject: `Check-in Assistance — ${booking.publicRef} departs in ~${hoursLeft}h`,
      template: "checkin_assistance_reminder",
      bookingId: booking.id,
      html: `<p><strong>Check-in booking assistance</strong> is required for the following flight:</p>
<ul>
<li><strong>Booking:</strong> ${vars.publicRef}</li>
<li><strong>Customer:</strong> ${vars.customerName} (${vars.customerPhone})</li>
<li><strong>PNR:</strong> ${vars.pnr}</li>
<li><strong>Airline:</strong> ${vars.airline}</li>
<li><strong>Sector:</strong> ${vars.sector}</li>
<li><strong>Departure:</strong> ${vars.departureAt}</li>
<li><strong>Time until departure:</strong> ~${vars.hoursLeft} hours</li>
</ul>
<p>Please follow up with the customer for check-in assistance.</p>`,
    });
  }

  if (agency?.phone) {
    results.whatsapp = await sendWhatsAppText({
      to: agency.phone,
      body: buildAdminCheckInMessage({ ...vars, departureAt: departure, hoursLeft }),
      bookingId: booking.id,
      template: "checkin_assistance_reminder",
    });
  }

  await prisma.flightBooking.update({
    where: { bookingId: booking.id },
    data: { checkInAssistanceNotifiedAt: new Date() },
  });

  await prisma.activityLog.create({
    data: {
      bookingId: booking.id,
      action: "CHECKIN_ASSISTANCE_ALERT_SENT",
      details: { hoursLeft, sector },
    },
  });

  return { success: true, results };
}

/** Run from cron — notify admins for assistance bookings entering the 48h window. */
export async function processCheckInAssistanceReminders() {
  const now = new Date();
  const candidates = await prisma.flightBooking.findMany({
    where: {
      checkInAssistance: true,
      checkInAssistanceNotifiedAt: null,
      earliestDepartureAt: { gt: now },
      booking: { status: { notIn: ["CANCELLED"] } },
    },
    include: { booking: { select: { id: true } } },
  });

  const processed: { bookingId: string; result: unknown }[] = [];

  for (const flight of candidates) {
    const departure = flight.earliestDepartureAt;
    if (!departure || !isDueForCheckInAssistanceNotification(departure, now)) continue;

    const result = await sendCheckInAssistanceAdminAlert(flight.bookingId);
    processed.push({ bookingId: flight.bookingId, result });
  }

  return { checked: candidates.length, processed: processed.length, details: processed };
}

/** After create/update — send immediately if already inside 48h window. */
export async function maybeSendImmediateCheckInAssistanceAlert(bookingId: string) {
  return sendCheckInAssistanceAdminAlert(bookingId);
}

export function flightFieldsWithDeparture<T extends { segments: FlightSegment[] }>(
  flight: T & { checkInAssistance?: boolean }
) {
  return {
    ...flight,
    earliestDepartureAt: getEarliestDeparture(flight.segments),
  };
}
