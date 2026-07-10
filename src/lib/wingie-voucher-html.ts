import type { AgencySettings, Booking, Customer, FlightBooking } from "@prisma/client";
import type { FlightPassenger, FlightSegment } from "@/types/booking";
import { getEmailLogoSrc, emailResponsiveStyles } from "@/lib/email-logo";
import { getVoucherTermsContent } from "@/templates/pdf/voucher-terms";
import { formatPassportDate } from "@/lib/passport-dates";
import {
  baggageLines,
  cabinClassDisplay,
  formatEndpoint,
  formatVoucherDob,
  formatVoucherInr,
  groupSegments,
  layoverLabel,
  paxTypeLabel,
  travelerDisplayName,
  voucherPaymentBreakdown,
  WINGIE_COLORS,
} from "@/lib/voucher-format";

const C = WINGIE_COLORS;

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const labelStyle = `font-size:9px;color:${C.label};margin-bottom:3px;font-weight:400;`;
const valueStyle = `font-size:9px;color:${C.text};`;

function sectionTitle(title: string) {
  return `<p style="margin:16px 0 8px;font-size:14px;font-weight:700;color:${C.navy};font-family:Arial,Helvetica,sans-serif;">${title}</p>`;
}

function agencyHeaderHtml(agency: AgencySettings, logoSrc: string | null) {
  const cityLine = [agency.city, agency.state, agency.pincode].filter(Boolean).join(", ");
  const logo = logoSrc
    ? `<img src="${logoSrc}" alt="${escapeHtml(agency.companyName)}" width="150" height="28" style="display:block;max-width:150px;height:auto;" />`
    : `<span style="font-size:20px;font-weight:700;color:#16a34a;letter-spacing:1px;">${escapeHtml(agency.companyName.toUpperCase())}</span>`;

  return `
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px;">
      <tr>
        <td valign="top" class="header-logo-cell" style="width:50%;">${logo}</td>
        <td valign="top" align="right" class="header-contact" style="font-size:8.5px;line-height:1.55;color:${C.label};font-family:Arial,Helvetica,sans-serif;">
          <div>${escapeHtml(agency.companyName)}</div>
          ${agency.address ? `<div>${escapeHtml(agency.address)}</div>` : ""}
          ${cityLine ? `<div>${escapeHtml(cityLine)}</div>` : ""}
          ${agency.phone ? `<div>${escapeHtml(agency.phone)}</div>` : ""}
          ${agency.email ? `<div>${escapeHtml(agency.email)}</div>` : ""}
        </td>
      </tr>
    </table>`;
}

function travelerDetailsHtml(pax: FlightPassenger, pnr: string, showInternationalDetails: boolean) {
  const name = escapeHtml(travelerDisplayName(pax));
  const passportRow =
    showInternationalDetails || pax.passportNumber
      ? `
      <tr>
        <td valign="top" width="25%" class="col-quarter" style="padding-right:8px;padding-bottom:8px;">
          <div style="${labelStyle}">Passport No</div>
          <div style="${valueStyle}">${escapeHtml(pax.passportNumber || "-")}</div>
        </td>
        <td valign="top" width="25%" class="col-quarter" style="padding-right:8px;padding-bottom:8px;">
          <div style="${labelStyle}">Passport Country</div>
          <div style="${valueStyle}">${escapeHtml(pax.passportIssuingCountry || "-")}</div>
        </td>
        <td valign="top" width="25%" class="col-quarter" style="padding-right:8px;padding-bottom:8px;">
          <div style="${labelStyle}">Passport Issue</div>
          <div style="${valueStyle}">${escapeHtml(formatPassportDate(pax.passportIssueDate))}</div>
        </td>
        <td valign="top" width="25%" align="right" class="col-quarter text-right-sm" style="padding-bottom:8px;">
          <div style="${labelStyle}text-align:right;">Passport Expiry</div>
          <div style="${valueStyle}text-align:right;">${escapeHtml(formatPassportDate(pax.passportExpiryDate))}</div>
        </td>
      </tr>`
      : "";

  return `
    ${sectionTitle("Traveler Details")}
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:16px;font-family:Arial,Helvetica,sans-serif;">
      <tr>
        <td valign="top" width="25%" class="col-quarter" style="padding-right:8px;padding-bottom:8px;">
          <div style="${labelStyle}">Traveler</div>
          <div style="${valueStyle}">${name} (${paxTypeLabel(pax.paxType)})</div>
        </td>
        <td valign="top" width="25%" class="col-quarter" style="padding-right:8px;padding-bottom:8px;">
          <div style="${labelStyle}">Ticket Number</div>
          <div style="${valueStyle}">${escapeHtml(pax.ticketNumber || "-")}</div>
        </td>
        <td valign="top" width="25%" class="col-quarter" style="padding-right:8px;padding-bottom:8px;">
          <div style="${labelStyle}">Airline (PNR)</div>
          <div style="${valueStyle}">${escapeHtml(pnr)}</div>
        </td>
        <td valign="top" width="25%" align="right" class="col-quarter text-right-sm" style="padding-bottom:8px;">
          <div style="${labelStyle}text-align:right;">Date of Birth</div>
          <div style="${valueStyle}text-align:right;">${escapeHtml(formatVoucherDob(pax.dateOfBirth))}</div>
        </td>
      </tr>
      ${passportRow}
    </table>`;
}

function flightSegmentHtml(seg: FlightSegment, airline: string, cabinClass: string) {
  const segAirline = escapeHtml(seg.airline || airline);
  return `
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:10px;font-family:Arial,Helvetica,sans-serif;">
      <tr>
        <td width="33%" valign="top" class="col-third" style="padding-bottom:6px;">
          <div style="${labelStyle}">Airline</div>
          <div style="${valueStyle}">${segAirline}</div>
        </td>
        <td width="33%" valign="top" class="col-third" style="padding-bottom:6px;">
          <div style="${labelStyle}">Flight Number</div>
          <div style="${valueStyle}">${escapeHtml(seg.flightNumber || "-")}</div>
        </td>
        <td width="33%" valign="top" class="col-third" style="padding-bottom:6px;">
          <div style="${labelStyle}">Class</div>
          <div style="${valueStyle}">${escapeHtml(cabinClassDisplay(cabinClass))}</div>
        </td>
      </tr>
      <tr>
        <td colspan="3" style="font-size:9px;color:${C.text};line-height:1.55;padding-bottom:3px;">
          Departure: ${escapeHtml(formatEndpoint(seg, "departure"))}
        </td>
      </tr>
      <tr>
        <td colspan="3" style="font-size:9px;color:${C.text};line-height:1.55;">
          Arrival: ${escapeHtml(formatEndpoint(seg, "arrival"))}
        </td>
      </tr>
    </table>`;
}

function layoverHtml(seg: FlightSegment, next: FlightSegment) {
  return `
    <table width="100%" cellpadding="0" cellspacing="0" style="margin:8px 0 10px;">
      <tr>
        <td style="border-top:1px dashed ${C.border};width:42%;"></td>
        <td align="center" style="padding:0 8px;font-size:8.5px;color:${C.muted};white-space:nowrap;font-family:Arial,Helvetica,sans-serif;">
          ${escapeHtml(layoverLabel(seg, next))}
        </td>
        <td style="border-top:1px dashed ${C.border};width:42%;"></td>
      </tr>
    </table>`;
}

function flightDetailsHtml(segments: FlightSegment[], tripType: string | null | undefined, airline: string, cabinClass: string) {
  const groups = groupSegments(segments, tripType);
  const legs = groups
    .map((group) => {
      const heading = `<p style="margin:0 0 8px;font-size:9px;font-weight:700;color:${C.navy};font-family:Arial,Helvetica,sans-serif;">${escapeHtml(group.label)}</p>`;
      const segs = group.segments
        .map((seg, sIdx) => {
          const block = flightSegmentHtml(seg, airline, cabinClass);
          const layover =
            sIdx < group.segments.length - 1 ? layoverHtml(seg, group.segments[sIdx + 1]) : "";
          return block + layover;
        })
        .join("");
      return heading + segs;
    })
    .join("");

  return `${sectionTitle("Flight Details")}${legs}`;
}

function baggageDetailsHtml(pax: FlightPassenger) {
  const lines = baggageLines(pax)
    .map((line) => `<div style="${valueStyle}line-height:1.5;">&bull; ${escapeHtml(line)}</div>`)
    .join("");

  return `
    ${sectionTitle("Baggage Details")}
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:14px;font-family:Arial,Helvetica,sans-serif;">
      <tr>
        <td width="50%" valign="top" class="col-half" style="padding-right:12px;">
          <div style="${labelStyle}">Traveler Name Surname</div>
          <div style="${valueStyle}">
            ${escapeHtml(travelerDisplayName(pax))} (${paxTypeLabel(pax.paxType)})
          </div>
        </td>
        <td width="50%" valign="top" class="col-half">
          <div style="${labelStyle}">Departure Baggage Allowance</div>
          ${lines}
        </td>
      </tr>
    </table>`;
}

function paymentHtml(flight: FlightBooking, totalAmount: number) {
  const baseFare = Number(flight.baseFare || 0);
  const taxes = Number(flight.cgstAmount || 0) + Number(flight.sgstAmount || 0) + Number(flight.igstAmount || 0);
  const discount = Number(flight.discountAmount || 0);
  const serviceCharge = Number(flight.serviceCharge || 0);
  const breakdown = voucherPaymentBreakdown({
    baseFare,
    serviceCharge,
    taxes,
    discount,
    total: totalAmount,
  });

  return `
    ${sectionTitle("Payment Information")}
    <table width="100%" cellpadding="0" cellspacing="0" style="background:${C.paymentBg};margin-bottom:10px;font-family:Arial,Helvetica,sans-serif;">
      <tr>
        <td style="padding:12px;">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td style="font-size:9px;color:${C.text};padding-bottom:5px;">Price</td>
              <td align="right" style="font-size:9px;color:${C.text};padding-bottom:5px;">${formatVoucherInr(breakdown.price)}</td>
            </tr>
            <tr>
              <td style="font-size:9px;color:${C.text};padding-bottom:5px;">Taxes</td>
              <td align="right" style="font-size:9px;color:${C.text};padding-bottom:5px;">${formatVoucherInr(breakdown.taxes)}</td>
            </tr>
            ${
              breakdown.discount > 0
                ? `<tr>
              <td style="font-size:9px;color:${C.text};padding-bottom:5px;">Special Discount</td>
              <td align="right" style="font-size:9px;color:${C.text};padding-bottom:5px;">-${formatVoucherInr(breakdown.discount)}</td>
            </tr>`
                : ""
            }
            <tr>
              <td colspan="2" align="right" style="padding-top:4px;font-size:14px;font-weight:700;color:${C.navy};">
                Total ${formatVoucherInr(breakdown.total)}
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
    <p style="margin:4px 0 0;font-size:8.5px;color:${C.muted};font-family:Arial,Helvetica,sans-serif;">
      &#9432; This is not an invoice. Your invoice will be sent within 7 days.
    </p>`;
}

function termsFooterHtml(companyName: string) {
  const terms = getVoucherTermsContent(companyName);
  const items = terms.sections
    .flatMap((section) =>
      (section.items || []).map(
        (item) =>
          `<p style="margin:0 0 6px;font-size:8.5px;line-height:1.5;color:${C.text};font-family:Georgia,'Times New Roman',serif;">
            <strong style="color:${C.navy};font-family:Arial,Helvetica,sans-serif;">${escapeHtml(item.label)}</strong> ${escapeHtml(item.text)}
          </p>`
      )
    )
    .join("");

  return `
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:24px;border:1px solid ${C.termsBorder};">
      <tr>
        <td style="padding:18px 20px;font-family:Arial,Helvetica,sans-serif;">
          <p style="margin:0 0 8px;font-size:14px;font-weight:700;color:${C.navy};">${escapeHtml(terms.title)}</p>
          <p style="margin:0 0 12px;font-size:9px;color:${C.text};">${escapeHtml(terms.intro)}</p>
          ${items}
          <p style="margin:14px 0 0;font-size:9.5px;font-weight:700;color:${C.navy};">${escapeHtml(terms.closing)}</p>
        </td>
      </tr>
    </table>`;
}

export async function buildWingieConfirmedEmailHtml(params: {
  agency: AgencySettings;
  booking: Booking;
  customer: Customer;
  flight: FlightBooking;
  /** Override for local HTML preview (e.g. data: URI). Emails use CID via getEmailLogoSrc(). */
  logoSrc?: string;
}) {
  const { agency, booking, flight, logoSrc: logoOverride } = params;
  const segments = flight.segments as unknown as FlightSegment[];
  const passengers = flight.passengers as unknown as FlightPassenger[];
  const pnr = booking.pnr || "-";
  const logoSrc = logoOverride ?? getEmailLogoSrc();
  const totalAmount = Number(booking.totalAmount);

  const showInternationalDetails = Boolean(flight.showEticket);

  const passengerBlocks = passengers
    .map((pax) => {
      return `
        ${travelerDetailsHtml(pax, pnr, showInternationalDetails)}
        ${flightDetailsHtml(segments, flight.tripType, flight.airline, flight.cabinClass)}
        ${baggageDetailsHtml(pax)}
        ${paymentHtml(flight, totalAmount)}
      `;
    })
    .join(`<div style="height:20px;"></div>`);

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(agency.companyName)} - E-Ticket</title>
  ${emailResponsiveStyles()}
</head>
<body style="margin:0;padding:0;background:#ffffff;width:100%;">
  <table width="100%" cellpadding="0" cellspacing="0" class="email-outer-pad" style="background:#ffffff;padding:16px 12px;width:100%;">
    <tr>
      <td align="center">
        <table cellpadding="0" cellspacing="0" class="email-container" style="max-width:600px;width:100%;background:#ffffff;padding:20px 16px 28px;">
          <tr>
            <td style="font-family:Arial,Helvetica,sans-serif;color:${C.navy};">
              ${agencyHeaderHtml(agency, logoSrc)}
              ${passengerBlocks}
              ${termsFooterHtml(agency.companyName)}
              <p style="margin:20px 0 0;font-size:8.5px;color:#9ca3af;line-height:1.5;">
                Your e-ticket PDF and invoice are attached to this email.
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
