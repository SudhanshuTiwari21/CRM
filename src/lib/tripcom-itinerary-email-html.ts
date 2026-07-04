import type { AgencySettings, Booking, Customer, FlightBooking } from "@prisma/client";
import type { FlightPassenger, FlightSegment } from "@/types/booking";
import { getEmailLogoSrc, emailResponsiveStyles } from "@/lib/email-logo";
import { getAirportDisplay } from "@/lib/airport-names";
import { groupSegments, voucherPaymentBreakdown, cabinClassDisplay } from "@/lib/voucher-format";
import { formatFlightWallClock, parseFlightDateTime } from "@/lib/flight-datetime";
import { formatSegmentDuration, computeLayoverDuration, layoverCityLabel } from "@/lib/flight-layover";
import { passengerDisplayName } from "@/lib/flight-fare-breakup";
import { toTitleCase } from "@/lib/utils";
import { buildEmailCopyrightHtml, buildEmailSocialButtonsHtml } from "@/lib/email-footer";

const BOOKTOROAM_SITE_URL = "https://booktoroam.in";

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

function primaryRoute(segments: FlightSegment[]) {
  if (!segments.length) return { route: "—", date: "" };
  const first = segments[0];
  const last = segments[segments.length - 1];
  return {
    route: `${toTitleCase(first.fromCity)} - ${toTitleCase(last.toCity)}`,
    date: formatTripDateShort(first.departureAt),
  };
}

function passengerTripLine(p: FlightPassenger) {
  return `<strong>${escapeHtml(toTitleCase(passengerDisplayName(p)))}</strong>`;
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

function segmentTimeOnly(iso?: string) {
  const parts = parseFlightDateTime(iso);
  if (!parts) return "—";
  return `${String(parts.hour).padStart(2, "0")}:${String(parts.minute).padStart(2, "0")}`;
}

function segmentDateCard(iso?: string) {
  if (!iso?.trim()) return "";
  return formatFlightWallClock(iso, "emailCard");
}

function segmentAirportName(city: string, code: string, fallbackCity?: string) {
  const entry = getAirportDisplay(code, fallbackCity || city);
  const name = entry.airportLine.includes(" - ")
    ? entry.airportLine.split(" - ").slice(1).join(" - ")
    : `${entry.city} Airport`;
  return name;
}

function visualSegmentCardHtml(seg: FlightSegment, flight: FlightBooking) {
  const depCode = escapeHtml(seg.fromAirport || "");
  const arrCode = escapeHtml(seg.toAirport || "");
  const depTime = segmentTimeOnly(seg.departureAt);
  const arrTime = segmentTimeOnly(seg.arrivalAt);
  const depDate = escapeHtml(segmentDateCard(seg.departureAt));
  const arrDate = escapeHtml(segmentDateCard(seg.arrivalAt));
  const depCity = escapeHtml(toTitleCase(seg.fromCity));
  const arrCity = escapeHtml(toTitleCase(seg.toCity));
  const depAirport = escapeHtml(segmentAirportName(seg.fromCity, seg.fromAirport, seg.fromCity));
  const arrAirport = escapeHtml(segmentAirportName(seg.toCity, seg.toAirport, seg.toCity));
  const depTerminal = seg.departureTerminal ? escapeHtml(`Terminal ${seg.departureTerminal.replace(/^T/i, "")}`) : "";
  const arrTerminal = seg.terminal ? escapeHtml(`Terminal ${seg.terminal.replace(/^T/i, "")}`) : "";
  const duration = escapeHtml(formatSegmentDuration(seg));
  const aircraft = escapeHtml(seg.aircraft || "—");
  const cabin = escapeHtml(cabinClassDisplay(flight.cabinClass));
  const airline = escapeHtml(seg.airline || flight.airline);
  const flightNo = escapeHtml(seg.flightNumber || "—");

  return `
    <tr>
      <td style="padding:16px 0;">
        <table width="100%" cellpadding="0" cellspacing="0" style="font-family:Arial,Helvetica,sans-serif;">
          <tr>
            <!-- Departure -->
            <td width="28%" valign="top" style="padding:0 4px 0 0;">
              <div style="font-size:17px;font-weight:700;color:${BLUE};">${depCode} ${depTime}</div>
              <div style="font-size:11px;color:${MUTED};padding-top:2px;">${depDate}</div>
              <div style="font-size:12px;font-weight:600;color:${TEXT};padding-top:6px;">${depCity}</div>
              <div style="font-size:11px;color:${MUTED};">${depAirport}</div>
              ${depTerminal ? `<div style="font-size:11px;color:${MUTED};">${depTerminal}</div>` : ""}
            </td>
            <!-- Duration & path -->
            <td width="18%" valign="top" align="center" style="padding-top:2px;">
              <div style="font-size:12px;font-weight:600;color:${TEXT};">${duration}</div>
              <div style="font-size:14px;color:${TEAL};letter-spacing:1px;padding:4px 0 2px;">&middot; &middot; &middot; &#9992; &middot; &middot; &middot;</div>
              <div style="font-size:11px;color:${MUTED};">1 Stop</div>
            </td>
            <!-- Arrival -->
            <td width="28%" valign="top" style="padding:0 4px;">
              <div style="font-size:17px;font-weight:700;color:${BLUE};">${arrCode} ${arrTime}</div>
              <div style="font-size:11px;color:${MUTED};padding-top:2px;">${arrDate}</div>
              <div style="font-size:12px;font-weight:600;color:${TEXT};padding-top:6px;">${arrCity}</div>
              <div style="font-size:11px;color:${MUTED};">${arrAirport}</div>
              ${arrTerminal ? `<div style="font-size:11px;color:${MUTED};">${arrTerminal}</div>` : ""}
            </td>
            <!-- Flight info -->
            <td width="26%" valign="top" style="padding-left:10px;border-left:1px solid ${BORDER};">
              <table cellpadding="0" cellspacing="0" style="font-family:Arial,Helvetica,sans-serif;">
                <tr>
                  <td style="font-size:11px;color:${MUTED};padding:2px 6px 2px 0;white-space:nowrap;">Aircraft</td>
                  <td style="font-size:11px;font-weight:600;color:${TEXT};padding:2px 0;">${aircraft}</td>
                </tr>
                <tr>
                  <td style="font-size:11px;color:${MUTED};padding:2px 6px 2px 0;white-space:nowrap;">Class</td>
                  <td style="font-size:11px;font-weight:600;color:${TEXT};padding:2px 0;">${cabin}</td>
                </tr>
                <tr>
                  <td style="font-size:11px;color:${MUTED};padding:2px 6px 2px 0;white-space:nowrap;">Airline</td>
                  <td style="font-size:11px;font-weight:600;color:${TEXT};padding:2px 0;">${airline}</td>
                </tr>
                <tr>
                  <td style="font-size:11px;color:${MUTED};padding:2px 6px 2px 0;white-space:nowrap;">Flight</td>
                  <td style="font-size:11px;font-weight:600;color:${BLUE};padding:2px 0;">&#9992; ${flightNo}</td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>`;
}

function layoverRowHtml(seg: FlightSegment, nextSeg: FlightSegment) {
  const duration = seg.layoverDuration || computeLayoverDuration(seg.arrivalAt, nextSeg.departureAt);
  const city = layoverCityLabel(seg);
  const airport = seg.layoverAirport || seg.toAirport;
  const label = duration
    ? `${escapeHtml(duration)} Layover at ${escapeHtml(city)}${airport ? ` (${escapeHtml(airport)})` : ""}`
    : `Layover at ${escapeHtml(city)}${airport ? ` (${escapeHtml(airport)})` : ""}`;

  return `
    <tr>
      <td style="padding:0;">
        <table width="100%" cellpadding="0" cellspacing="0" style="border-top:1px dashed ${BORDER};border-bottom:1px dashed ${BORDER};">
          <tr>
            <td style="padding:8px 12px;font-size:12px;color:${MUTED};font-family:Arial,Helvetica,sans-serif;text-align:center;">
              &#128337; ${label}
            </td>
          </tr>
        </table>
      </td>
    </tr>`;
}

function visualFlightDetailsHtml(params: {
  flight: FlightBooking;
  segments: FlightSegment[];
}) {
  const groups = groupSegments(params.segments, params.flight.tripType);

  const groupsHtml = groups.map((group) => {
    const first = group.segments[0];
    const last = group.segments[group.segments.length - 1];
    const routeTitle = `${escapeHtml(toTitleCase(first?.fromCity || ""))} &#10148; ${escapeHtml(toTitleCase(last?.toCity || ""))}`;

    const segmentCards = group.segments.map((seg, i) => {
      const card = visualSegmentCardHtml(seg, params.flight);
      if (i < group.segments.length - 1) {
        return card + layoverRowHtml(seg, group.segments[i + 1]);
      }
      return card;
    }).join("");

    return `
      <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:16px;border:1px solid ${BORDER};border-radius:8px;font-family:Arial,Helvetica,sans-serif;">
        <tr>
          <td style="padding:12px 16px;background:#f8fafc;border-bottom:1px solid ${BORDER};border-radius:8px 8px 0 0;">
            <span style="font-size:15px;font-weight:700;color:${TEXT};">${routeTitle}</span>
          </td>
        </tr>
        <tr>
          <td style="padding:0 16px;">
            <table width="100%" cellpadding="0" cellspacing="0">
              ${segmentCards}
            </table>
          </td>
        </tr>
      </table>`;
  }).join("");

  return `
    <p style="margin:28px 0 12px;font-size:18px;font-weight:700;color:${TEXT};font-family:Arial,Helvetica,sans-serif;">Flight Details</p>
    <p style="margin:0 0 8px;font-size:11px;color:${MUTED};font-family:Arial,Helvetica,sans-serif;">* All departure/arrival times are in local time.</p>
    ${groupsHtml}`;
}

function paymentCardHtml(params: {
  flight: FlightBooking;
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

  const discountRow =
    breakdown.discount > 0
      ? `<tr>
          <td style="padding:5px 0;font-size:13px;color:${TEXT};font-family:Arial,Helvetica,sans-serif;">Special Discount</td>
          <td align="right" style="padding:5px 0;font-size:13px;color:${TEXT};font-family:Arial,Helvetica,sans-serif;">-${formatTripInr(breakdown.discount)}</td>
        </tr>`
      : "";

  return `
    <p style="margin:28px 0 12px;font-size:18px;font-weight:700;color:${TEXT};font-family:Arial,Helvetica,sans-serif;">Payment Info</p>
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
    </table>`;
}

function paymentFlightCard(params: {
  flight: FlightBooking;
  segments: FlightSegment[];
  totalAmount: number;
}) {
  return visualFlightDetailsHtml({ flight: params.flight, segments: params.segments })
    + paymentCardHtml({ flight: params.flight, totalAmount: params.totalAmount });
}

function helpSectionPendingHtml() {
  return `
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:24px;font-family:Arial,Helvetica,sans-serif;">
      <tr>
        <td style="padding-bottom:6px;font-size:15px;font-weight:700;color:${TEXT};">Name is incorrect?</td>
      </tr>
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

function helpSectionConfirmedHtml(agency: AgencySettings) {
  const phone = agency.phone?.trim();
  const email = agency.email?.trim();
  const contact =
    phone && email
      ? `call <strong>${escapeHtml(phone)}</strong> or email <strong>${escapeHtml(email)}</strong>`
      : phone
        ? `call <strong>${escapeHtml(phone)}</strong>`
        : email
          ? `email <strong>${escapeHtml(email)}</strong>`
          : "contact our support team";

  return `
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:24px;font-family:Arial,Helvetica,sans-serif;">
      <tr>
        <td style="padding-bottom:6px;font-size:15px;font-weight:700;color:${TEXT};">Name is incorrect?</td>
      </tr>
      <tr>
        <td style="padding-bottom:14px;font-size:14px;color:${TEXT};line-height:1.65;">
          Please ${contact} as soon as possible. Name changes after ticketing are subject to airline rules and fees.
        </td>
      </tr>
      <tr>
        <td style="padding-bottom:6px;font-size:15px;font-weight:700;color:${TEXT};">Need to change dates or itinerary?</td>
      </tr>
      <tr>
        <td style="padding-bottom:14px;font-size:14px;color:${TEXT};line-height:1.65;">
          Date or route changes depend on your fare rules. Please contact us and we&apos;ll help you with the airline.
        </td>
      </tr>
      <tr>
        <td style="padding-bottom:6px;font-size:15px;font-weight:700;color:${TEXT};">Where is my full itinerary?</td>
      </tr>
      <tr>
        <td style="padding-bottom:20px;font-size:14px;color:${TEXT};line-height:1.65;">
          Your complete e-ticket, baggage details, and invoice are in the <strong>PDF attachments</strong> to this email — not repeated in this message.
        </td>
      </tr>
    </table>`;
}

function manageBookingButtonHtml() {
  return `
    <table width="100%" cellpadding="0" cellspacing="0" style="margin:8px 0 4px;">
      <tr>
        <td align="center" style="padding:16px 0 8px;">
          <a href="${BOOKTOROAM_SITE_URL}" style="display:inline-block;padding:11px 36px;border:1px solid ${BLUE};border-radius:4px;color:${BLUE};font-size:15px;font-weight:600;text-decoration:none;font-family:Arial,Helvetica,sans-serif;">
            Manage My Booking
          </a>
        </td>
      </tr>
    </table>`;
}

function confirmedInfoBoxHtml(params: {
  route: string;
  date: string;
  pnr: string;
  secondaryPnr?: string | null;
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

  const pnrBlock = params.secondaryPnr?.trim()
    ? `<tr>
        <td style="padding-top:8px;font-size:14px;color:${TEXT};line-height:1.6;">
          Outbound PNR: <strong>${escapeHtml(params.pnr)}</strong>
          &nbsp;&middot;&nbsp;
          Return PNR: <strong>${escapeHtml(params.secondaryPnr.trim())}</strong>
        </td>
      </tr>`
    : `<tr>
        <td style="padding-top:8px;font-size:14px;color:${TEXT};line-height:1.6;">
          Airline (PNR): <strong>${escapeHtml(params.pnr)}</strong>
        </td>
      </tr>`;

  return `
    <table width="100%" cellpadding="0" cellspacing="0" style="margin:20px 0;border:1px solid ${TEAL};border-radius:8px;">
      <tr>
        <td style="padding:18px 20px;font-family:Arial,Helvetica,sans-serif;">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td style="padding-bottom:10px;font-size:14px;font-weight:600;color:${TEAL};">
                <span style="display:inline-block;width:18px;height:18px;border-radius:9px;background:${TEAL};color:#fff;text-align:center;line-height:18px;font-size:11px;margin-right:6px;">&#10003;</span>
                Your tickets have been issued
              </td>
            </tr>
            <tr>
              <td style="font-size:20px;font-weight:700;color:${TEXT};line-height:1.35;">
                ${escapeHtml(params.route)}${params.date ? ` | ${escapeHtml(params.date)}` : ""}
              </td>
            </tr>
            ${pnrBlock}
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

function wrapTripcomEmail(title: string, body: string) {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
  ${emailResponsiveStyles()}
</head>
<body style="margin:0;padding:0;background:#ffffff;font-family:Arial,Helvetica,sans-serif;width:100%;">
  <table width="100%" cellpadding="0" cellspacing="0" class="email-outer-pad" style="background:#ffffff;padding:16px 12px;width:100%;">
    <tr>
      <td align="center">
        <table cellpadding="0" cellspacing="0" class="email-container" style="max-width:600px;width:100%;background:#ffffff;padding:8px 16px 28px;">
          <tr>
            <td>${body}</td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function tripcomFooterHtml(agency: AgencySettings) {
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
          <p style="margin:0 0 0;font-size:13px;color:${MUTED};line-height:1.6;text-align:left;">
            Reach our customer support team for booking assistance and ticket updates.
          </p>
          <table width="100%" cellpadding="0" cellspacing="0" style="border-top:1px dashed ${BORDER};margin-top:16px;">
            <tr>
              <td style="padding:14px 0 0;font-size:12px;color:${MUTED};line-height:1.7;text-align:left;">
                Please do not reply to this message. This email was sent from a notification-only email address that cannot accept incoming emails.<br />
                Do not forward this mail as it contains your personal information and booking details.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
    <p style="margin:20px 0 0;text-align:center;font-size:13px;color:${RED};line-height:1.6;font-family:Arial,Helvetica,sans-serif;">
      Please be cautious when forwarding this email as it contains personal information and booking details that could be modified or canceled by the recipient.
    </p>
    ${buildEmailSocialButtonsHtml({ headingColor: TEXT })}
    ${buildEmailCopyrightHtml(agency.companyName, { mutedColor: MUTED })}`;
}

export async function buildItineraryVoucherEmailHtml(params: {
  agency: AgencySettings;
  booking: Booking;
  customer: Customer;
  flight: FlightBooking;
  logoSrc?: string;
}) {
  const { agency, booking, customer, flight, logoSrc: logoOverride } = params;
  const segments = flight.segments as unknown as FlightSegment[];
  const passengers = flight.passengers as unknown as FlightPassenger[];
  const { route, date } = primaryRoute(segments);
  const customerName = escapeHtml(toTitleCase(customer.name));
  const logoSrc = logoOverride ?? getEmailLogoSrc();

  const body = `
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

              ${manageBookingButtonHtml()}

              ${helpSectionPendingHtml()}

              ${paymentFlightCard({
                flight,
                segments,
                totalAmount: Number(booking.totalAmount),
              })}

              ${tripcomFooterHtml(agency)}`;

  return wrapTripcomEmail(`${escapeHtml(agency.companyName)} — Booking Confirmed`, body);
}

/** Trip.com-style confirmation after PNR — message only; full ticket is in PDF attachment. */
export async function buildTripcomConfirmedEmailHtml(params: {
  agency: AgencySettings;
  booking: Booking;
  customer: Customer;
  flight: FlightBooking;
  logoSrc?: string;
}) {
  const { agency, booking, customer, flight, logoSrc: logoOverride } = params;
  const segments = flight.segments as unknown as FlightSegment[];
  const passengers = flight.passengers as unknown as FlightPassenger[];
  const { route, date } = primaryRoute(segments);
  const customerName = escapeHtml(toTitleCase(customer.name));
  const logoSrc = logoOverride ?? getEmailLogoSrc();
  const pnr = booking.pnr || "—";

  const body = `
              ${headerHtml(agency, logoSrc, booking.publicRef)}

              <h1 style="margin:0 0 18px;font-size:28px;font-weight:700;color:${TEXT};line-height:1.25;font-family:Arial,Helvetica,sans-serif;">
                Payment Successful
              </h1>

              <p style="margin:0 0 14px;font-size:15px;line-height:1.65;color:${TEXT};">
                Dear <strong>${customerName}</strong>,
              </p>
              <p style="margin:0 0 14px;font-size:15px;line-height:1.65;color:${TEXT};">
                We&apos;ve received your payment. <strong>Your ticket has been issued</strong> by the airline.
                Your complete e-ticket and invoice are <strong>attached to this email</strong>.
              </p>
              <p style="margin:0 0 4px;font-size:15px;line-height:1.65;color:${TEXT};">
                Please open the PDF attachment for traveler details, flight times, baggage allowance, and terms.
              </p>

              ${confirmedInfoBoxHtml({
                route,
                date,
                pnr,
                secondaryPnr: flight.secondaryPnr,
                passengers,
              })}

              ${manageBookingButtonHtml()}

              ${helpSectionConfirmedHtml(agency)}

              ${paymentFlightCard({
                flight,
                segments,
                totalAmount: Number(booking.totalAmount),
              })}

              ${tripcomFooterHtml(agency)}`;

  return wrapTripcomEmail(`${escapeHtml(agency.companyName)} — E-Ticket Ready`, body);
}
