import type { AgencySettings, Booking, Customer, FlightBooking } from "@prisma/client";
import type { FlightPassenger, FlightSegment } from "@/types/booking";
import { getPdfLogoDataUri } from "@/lib/pdf-logo";
import { getAirportDisplay } from "@/lib/airport-names";
import { cabinLabel, groupSegments, voucherPaymentBreakdown } from "@/lib/voucher-format";
import { formatFlightWallClock } from "@/lib/flight-datetime";

const BLUE = "#2346dc";
const TEAL = "#00b2d1";
const TEXT = "#0f294d";
const MUTED = "#5f6b7a";
const BORDER = "#e5e7eb";
const RED = "#d93025";

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatTripInr(amount: number) {
  return `INR ${amount.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatTripDateShort(iso?: string) {
  if (!iso?.trim()) return "";
  return formatFlightWallClock(iso, "short");
}

function formatTripFlightTime(iso?: string) {
  if (!iso?.trim()) return "—";
  return formatFlightWallClock(iso, "trip");
}

function tripAirportLine(city: string, code: string, fallbackCity?: string, terminal?: string) {
  const entry = getAirportDisplay(code, fallbackCity || city);
  const name = entry.airportLine.includes(" - ")
    ? entry.airportLine.split(" - ").slice(1).join(" - ")
    : `${entry.city} International Airport`;
  const terminalSuffix = terminal
    ? terminal.toLowerCase().startsWith("terminal")
      ? ` ${terminal}`
      : ` Terminal ${terminal.replace(/^T/i, "")}`
    : "";
  return `${name}${terminalSuffix}`;
}

function primaryRoute(segments: FlightSegment[]) {
  if (!segments.length) return { route: "—", date: "" };
  const first = segments[0];
  const last = segments[segments.length - 1];
  return {
    route: `${first.fromCity} - ${last.toCity}`,
    date: formatTripDateShort(first.departureAt),
  };
}

function passengerTripLine(p: FlightPassenger) {
  const first = escapeHtml(p.firstName.toUpperCase());
  const last = escapeHtml((p.lastName || "").toUpperCase());
  return `<strong>${first}</strong> <span style="color:${MUTED};font-weight:400;">(First name)</span> <strong>${last || "—"}</strong> <span style="color:${MUTED};font-weight:400;">(Last name)</span>`;
}

function headerHtml(agency: AgencySettings, logoSrc: string | null, publicRef: string) {
  const logo = logoSrc
    ? `<img src="${logoSrc}" alt="${escapeHtml(agency.companyName)}" width="140" height="26" style="display:block;max-width:140px;height:auto;" />`
    : `<span style="font-size:26px;font-weight:700;color:${BLUE};letter-spacing:-0.5px;">${escapeHtml(agency.companyName)}</span>`;

  return `
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
      <tr>
        <td valign="middle">${logo}</td>
        <td valign="middle" align="right" style="font-family:Arial,Helvetica,sans-serif;font-size:13px;color:${MUTED};">
          Booking No. <span style="color:${BLUE};font-weight:600;">${escapeHtml(publicRef)}</span>
        </td>
      </tr>
    </table>`;
}

function infoBoxHtml(params: {
  companyName: string;
  route: string;
  date: string;
  passengers: FlightPassenger[];
}) {
  const paxRows = params.passengers
    .map(
      (p) => `
      <tr>
        <td style="padding-top:10px;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:${TEXT};line-height:1.6;">
          <span style="color:${TEXT};font-size:16px;margin-right:6px;">&#128100;</span>
          ${passengerTripLine(p)}
        </td>
      </tr>`
    )
    .join("");

  return `
    <table width="100%" cellpadding="0" cellspacing="0" style="margin:20px 0;border:1px solid ${TEAL};border-radius:8px;">
      <tr>
        <td style="padding:18px 20px;font-family:Arial,Helvetica,sans-serif;">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td style="padding-bottom:10px;font-size:14px;font-weight:600;color:${TEAL};">
                <span style="display:inline-block;width:18px;height:18px;border-radius:9px;background:${TEAL};color:#fff;text-align:center;line-height:18px;font-size:11px;margin-right:6px;">&#10003;</span>
                ${escapeHtml(params.companyName)} guarantees your tickets will be issued
              </td>
            </tr>
            <tr>
              <td style="font-size:20px;font-weight:700;color:${TEXT};line-height:1.35;">
                ${escapeHtml(params.route)}${params.date ? ` | ${escapeHtml(params.date)}` : ""}
              </td>
            </tr>
            <tr>
              <td style="padding-top:8px;font-size:14px;color:${MUTED};line-height:1.6;">
                E-ticket number &amp; PNR will be shared within <strong style="color:${TEXT};">24 hours</strong> after airline confirmation.
              </td>
            </tr>
            <tr>
              <td style="padding-top:14px;border-top:1px solid #d4f1f6;">
                <table width="100%" cellpadding="0" cellspacing="0">${paxRows}</table>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>`;
}

function paymentFlightCard(params: {
  flight: FlightBooking;
  segments: FlightSegment[];
  totalAmount: number;
}) {
  const baseFare = Number(params.flight.baseFare ?? 0);
  const serviceCharge = Number(params.flight.serviceCharge ?? 0);
  const taxes =
    Number(params.flight.cgstAmount ?? 0) +
    Number(params.flight.sgstAmount ?? 0) +
    Number(params.flight.igstAmount ?? 0);
  const discount = Number(params.flight.discountAmount ?? 0);
  const breakdown = voucherPaymentBreakdown({
    baseFare,
    serviceCharge,
    taxes,
    discount,
    total: params.totalAmount,
  });

  const groups = groupSegments(params.segments, params.flight.tripType);
  const flightLegs = groups
    .flatMap((group) =>
      group.segments.map((seg) => {
        const route = `${escapeHtml(seg.fromCity)} - ${escapeHtml(seg.toCity)}`;
        const airline = escapeHtml(seg.airline || params.flight.airline);
        const flightNo = escapeHtml(seg.flightNumber || "—");
        const cabin = escapeHtml(cabinLabel(params.flight.cabinClass));
        const depTime = formatTripFlightTime(seg.departureAt);
        const arrTime = formatTripFlightTime(seg.arrivalAt);
        const depAirport = escapeHtml(
          tripAirportLine(seg.fromCity, seg.fromAirport, seg.fromCity, seg.departureTerminal)
        );
        const arrAirport = escapeHtml(
          tripAirportLine(seg.toCity, seg.toAirport, seg.toCity, seg.terminal)
        );
        return `
          <tr><td colspan="2" style="padding:14px 0 6px;font-size:15px;font-weight:700;color:${TEXT};font-family:Arial,Helvetica,sans-serif;">${route}</td></tr>
          <tr><td colspan="2" style="padding:0 0 10px;font-size:13px;color:${MUTED};font-family:Arial,Helvetica,sans-serif;">${airline} &middot; ${flightNo} (${cabin})</td></tr>
          <tr><td colspan="2" style="padding:0 0 4px;font-size:13px;color:${TEXT};font-family:Arial,Helvetica,sans-serif;">Departing: ${depTime}, ${depAirport}</td></tr>
          <tr><td colspan="2" style="padding:0 0 14px;font-size:13px;color:${TEXT};font-family:Arial,Helvetica,sans-serif;">Arrival: ${arrTime}, ${arrAirport}</td></tr>`;
      })
    )
    .join("");

  const discountRow =
    breakdown.discount > 0
      ? `<tr>
          <td style="padding:5px 0;font-size:13px;color:${TEXT};font-family:Arial,Helvetica,sans-serif;">Special Discount</td>
          <td align="right" style="padding:5px 0;font-size:13px;color:${TEXT};font-family:Arial,Helvetica,sans-serif;">-${formatTripInr(breakdown.discount)}</td>
        </tr>`
      : "";

  return `
    <p style="margin:28px 0 12px;font-size:18px;font-weight:700;color:${TEXT};font-family:Arial,Helvetica,sans-serif;">Payment &amp; Flight Info</p>
    <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid ${BORDER};border-radius:8px;">
      <tr>
        <td style="padding:18px 20px;">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td style="font-size:22px;font-weight:700;color:${TEXT};font-family:Arial,Helvetica,sans-serif;">Total</td>
              <td align="right" style="font-size:22px;font-weight:700;color:${TEXT};font-family:Arial,Helvetica,sans-serif;">${formatTripInr(breakdown.total)}</td>
            </tr>
            <tr><td colspan="2" style="padding:10px 0;border-bottom:1px solid ${BORDER};"></td></tr>
            <tr>
              <td style="padding:5px 0;font-size:13px;color:${TEXT};font-family:Arial,Helvetica,sans-serif;">Fare</td>
              <td align="right" style="padding:5px 0;font-size:13px;color:${TEXT};font-family:Arial,Helvetica,sans-serif;">${formatTripInr(breakdown.price)}</td>
            </tr>
            <tr>
              <td style="padding:5px 0;font-size:13px;color:${TEXT};font-family:Arial,Helvetica,sans-serif;">Taxes &amp; fees</td>
              <td align="right" style="padding:5px 0;font-size:13px;color:${TEXT};font-family:Arial,Helvetica,sans-serif;">${formatTripInr(breakdown.taxes)}</td>
            </tr>
            ${discountRow}
          </table>
        </td>
      </tr>
      <tr>
        <td style="padding:0 20px 18px;border-top:1px solid ${BORDER};">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td style="padding:12px 0 8px;font-size:11px;color:${MUTED};font-family:Arial,Helvetica,sans-serif;">* All departure/arrival times are in local time.</td>
            </tr>
            ${flightLegs}
          </table>
        </td>
      </tr>
    </table>`;
}

function helpSectionHtml(companyName: string) {
  return `
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:24px;font-family:Arial,Helvetica,sans-serif;">
      <tr>
        <td style="padding-bottom:14px;font-size:14px;color:${TEXT};line-height:1.65;">
          Direct name or travel document changes aren&apos;t available before tickets are issued. Please contact us to cancel and rebook with the correct details.
        </td>
      </tr>
      <tr>
        <td style="padding-bottom:6px;font-size:15px;font-weight:700;color:${TEXT};">Need to change dates or itinerary?</td>
      </tr>
      <tr>
        <td style="padding-bottom:14px;font-size:14px;color:${TEXT};line-height:1.65;">
          Please contact our team to review available options before tickets are issued. Depending on your booking, you may need to cancel and rebook.
        </td>
      </tr>
      <tr>
        <td style="padding-bottom:6px;font-size:15px;font-weight:700;color:${TEXT};">Haven&apos;t received your itinerary yet?</td>
      </tr>
      <tr>
        <td style="padding-bottom:14px;font-size:14px;color:${TEXT};line-height:1.65;">
          Your itinerary and e-receipt will be sent after tickets are issued.
        </td>
      </tr>
      <tr>
        <td style="padding-bottom:20px;font-size:14px;color:${TEXT};line-height:1.65;">
          If issuance takes longer than expected, we&apos;ll handle it with the airline and keep you updated. Your <strong>booking voucher and invoice</strong> are attached to this email.
        </td>
      </tr>
    </table>`;
}

function tripcomFooterHtml(agency: AgencySettings) {
  const year = new Date().getFullYear();
  const phone = agency.phone ? escapeHtml(agency.phone) : "";
  const email = agency.email ? escapeHtml(agency.email) : "";

  return `
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:8px;border:1px solid ${BORDER};border-radius:8px;">
      <tr>
        <td style="padding:24px 20px;font-family:Arial,Helvetica,sans-serif;text-align:center;">
          <p style="margin:0 0 6px;font-size:16px;font-weight:700;color:${TEXT};">Contact us anytime</p>
          <p style="margin:0 0 16px;font-size:13px;color:${MUTED};line-height:1.6;">
            Our team is available to help with your booking.
            ${phone ? `<br />Phone: <strong style="color:${TEXT};">${phone}</strong>` : ""}
            ${email ? `<br />Email: <strong style="color:${TEXT};">${email}</strong>` : ""}
          </p>
          <p style="margin:0 0 20px;font-size:14px;font-weight:600;color:${TEAL};">
            &#10003; Travel worry-free with our service guarantee &rsaquo;
          </p>
          <p style="margin:0 0 6px;font-size:15px;font-weight:700;color:${TEXT};text-align:left;">Service you can rely on</p>
          <p style="margin:0 0 16px;font-size:13px;color:${MUTED};line-height:1.6;text-align:left;">
            Reach our customer support team for booking assistance and ticket updates.
          </p>
          <table width="100%" cellpadding="0" cellspacing="0" style="border-top:1px dashed ${BORDER};margin-top:8px;">
            <tr>
              <td style="padding:14px 0 0;font-size:12px;color:${MUTED};line-height:1.7;text-align:left;">
                Please do not reply to this message. This email was sent from a notification-only email address that cannot accept incoming emails.<br />
                Do not forward this mail as it contains your personal information and booking details.<br /><br />
                Copyright &copy; ${year} ${escapeHtml(agency.companyName)}. All rights reserved.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
    <p style="margin:20px 0 0;text-align:center;font-size:13px;color:${RED};line-height:1.6;font-family:Arial,Helvetica,sans-serif;">
      Please be cautious when forwarding this email as it contains personal information and booking details that could be modified or canceled by the recipient.
    </p>`;
}

export async function buildItineraryVoucherEmailHtml(params: {
  agency: AgencySettings;
  booking: Booking;
  customer: Customer;
  flight: FlightBooking;
}) {
  const { agency, booking, customer, flight } = params;
  const segments = flight.segments as unknown as FlightSegment[];
  const passengers = flight.passengers as unknown as FlightPassenger[];
  const { route, date } = primaryRoute(segments);
  const customerName = escapeHtml(customer.name.toUpperCase());
  const logoSrc = await getPdfLogoDataUri();

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(agency.companyName)} — Booking Confirmed</title>
</head>
<body style="margin:0;padding:0;background:#ffffff;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff;padding:24px 12px;">
    <tr>
      <td align="center">
        <table width="640" cellpadding="0" cellspacing="0" style="max-width:640px;width:100%;background:#ffffff;padding:8px 20px 28px;">
          <tr>
            <td>
              ${headerHtml(agency, logoSrc, booking.publicRef)}

              <h1 style="margin:0 0 18px;font-size:28px;font-weight:700;color:${TEXT};line-height:1.25;font-family:Arial,Helvetica,sans-serif;">
                Your booking has been confirmed
              </h1>

              <p style="margin:0 0 14px;font-size:15px;line-height:1.65;color:${TEXT};">
                Dear <strong>${customerName}</strong>,
              </p>
              <p style="margin:0 0 14px;font-size:15px;line-height:1.65;color:${TEXT};">
                Thank you for booking with <strong>${escapeHtml(agency.companyName)}</strong>.
                Your ticket is currently being processed and will be issued within a <strong>maximum of 24 hours</strong>.
              </p>
              <p style="margin:0 0 6px;font-size:15px;line-height:1.65;color:${TEXT};">
                Once issued, we&apos;ll send you <strong>a confirmation email</strong> with your e-ticket number, PNR, itinerary and e-receipt attached.
              </p>
              <p style="margin:0 0 4px;font-size:15px;line-height:1.65;color:${TEXT};">
                Your <strong>booking voucher and invoice</strong> are attached to this email for your reference.
              </p>

              ${infoBoxHtml({ companyName: agency.companyName, route, date, passengers })}

              ${helpSectionHtml(agency.companyName)}

              ${paymentFlightCard({
                flight,
                segments,
                totalAmount: Number(booking.totalAmount),
              })}

              ${tripcomFooterHtml(agency)}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
