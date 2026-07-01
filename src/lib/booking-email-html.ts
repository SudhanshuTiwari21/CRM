import { format } from "date-fns";
import type { AgencySettings, Booking, Customer, FlightBooking, HotelBooking } from "@prisma/client";
import type { FlightPassenger, FlightSegment } from "@/types/booking";
import { CABIN_CLASS_OPTIONS } from "@/lib/constants/flight";
import { formatInr } from "@/lib/gst-calculator";
import { passengerDisplayName } from "@/lib/flight-fare-breakup";
import { toTitleCase } from "@/lib/utils";
import { buildEmailCopyrightHtml, buildEmailSocialButtonsHtml } from "@/lib/email-footer";

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function cabinLabel(value?: string | null) {
  return CABIN_CLASS_OPTIONS.find((o) => o.value === value)?.label || "Economy";
}

function formatFlightDateTime(iso?: string) {
  if (!iso?.trim()) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return format(d, "HH:mm, MMM d, yyyy");
}

function airportLabel(seg: FlightSegment, kind: "from" | "to") {
  const city = kind === "from" ? seg.fromCity : seg.toCity;
  const code = kind === "from" ? seg.fromAirport : seg.toAirport;
  const terminal = kind === "from" ? seg.departureTerminal : seg.terminal;
  const base = city && code ? `${city} (${code})` : city || code || "—";
  return terminal ? `${base} T${terminal.replace(/^T/i, "")}` : base;
}

function primaryRoute(segments: FlightSegment[]) {
  if (!segments.length) return { route: "—", date: "" };
  const first = segments[0];
  const last = segments[segments.length - 1];
  const route = `${toTitleCase(first.fromCity)} - ${toTitleCase(last.toCity)}`;
  const date = first.departureAt ? format(new Date(first.departureAt), "MMM d, yyyy") : "";
  return { route, date };
}

function passengerLines(passengers: FlightPassenger[]) {
  return passengers.map((p) => escapeHtml(toTitleCase(passengerDisplayName(p))));
}

function paymentRows(flight: FlightBooking, totalAmount: number) {
  const baseFare = Number(flight.baseFare ?? 0);
  const serviceCharge = Number(flight.serviceCharge ?? 0);
  const discount = Number(flight.discountAmount ?? 0);
  const gateway = Number(flight.paymentGatewayCharge ?? 0);
  const taxTotal =
    Number(flight.cgstAmount ?? 0) + Number(flight.sgstAmount ?? 0) + Number(flight.igstAmount ?? 0);
  const fare = baseFare > 0 ? baseFare : Math.max(0, totalAmount - serviceCharge - taxTotal - gateway + discount);

  const rows: { label: string; value: string; highlight?: boolean }[] = [
    { label: "Fare", value: formatInr(fare) },
    { label: "Taxes &amp; fees", value: formatInr(taxTotal) },
  ];
  if (serviceCharge > 0) rows.push({ label: "Service charge", value: formatInr(serviceCharge) });
  if (gateway > 0) rows.push({ label: "Payment gateway charge", value: formatInr(gateway) });
  if (discount > 0) rows.push({ label: "Discount", value: `-${formatInr(discount)}` });

  return { rows, total: formatInr(totalAmount) };
}

function flightLegsHtml(segments: FlightSegment[], airline: string, cabinClass: string) {
  return segments
    .map((seg) => {
      const route = `${escapeHtml(toTitleCase(seg.fromCity))} - ${escapeHtml(toTitleCase(seg.toCity))}`;
      const flightInfo = `${escapeHtml(seg.airline || airline)} · ${escapeHtml(seg.flightNumber)} (${cabinLabel(cabinClass)})`;
      return `
        <tr>
          <td style="padding:16px 0 0;color:#111827;font-size:15px;font-weight:700;">${route}</td>
        </tr>
        <tr>
          <td style="padding:4px 0 12px;color:#4b5563;font-size:14px;">${flightInfo}</td>
        </tr>
        <tr>
          <td style="padding:0 0 6px;color:#374151;font-size:14px;line-height:1.6;">
            <strong>Departing:</strong> ${formatFlightDateTime(seg.departureAt)} (${escapeHtml(airportLabel(seg, "from"))})
          </td>
        </tr>
        <tr>
          <td style="padding:0 0 20px;color:#374151;font-size:14px;line-height:1.6;">
            <strong>Arrival:</strong> ${formatFlightDateTime(seg.arrivalAt)} (${escapeHtml(airportLabel(seg, "to"))})
          </td>
        </tr>`;
    })
    .join("");
}

function emailShell(content: string, companyName: string, companyPhone?: string | null) {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(companyName)}</title>
</head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:Arial,Helvetica,sans-serif;color:#111827;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:24px 12px;">
    <tr>
      <td align="center">
        <table width="640" cellpadding="0" cellspacing="0" style="max-width:640px;width:100%;background:#ffffff;">
          ${content}
          <tr>
            <td style="padding:24px 32px 8px;color:#dc2626;font-size:13px;line-height:1.6;text-align:center;">
              Please be cautious when forwarding this email as it contains personal information and booking details that could be modified or canceled by the recipient.
            </td>
          </tr>
          <tr>
            <td style="padding:8px 32px 0;color:#9ca3af;font-size:12px;line-height:1.7;">
              Please do not reply to this message. This email was sent from a notification-only email address, and replies are not monitored.
              Do not forward this mail as it contains your personal information and booking details.
              ${companyPhone ? `<br /><br />Support: ${escapeHtml(companyPhone)}` : ""}
            </td>
          </tr>
          <tr>
            <td style="padding:0 32px;">
              ${buildEmailSocialButtonsHtml({ headingColor: "#111827" })}
            </td>
          </tr>
          <tr>
            <td style="padding:0 32px 32px;">
              ${buildEmailCopyrightHtml(companyName, { mutedColor: "#9ca3af", paddingBottom: "0" })}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function headerRow(companyName: string, publicRef: string) {
  return `
    <tr>
      <td style="padding:28px 32px 12px;border-bottom:1px solid #e5e7eb;">
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td style="font-size:28px;font-weight:700;color:#2563eb;letter-spacing:-0.5px;">${escapeHtml(companyName)}</td>
            <td align="right" style="font-size:13px;color:#6b7280;white-space:nowrap;">
              Booking No.<br />
              <span style="color:#2563eb;font-size:16px;font-weight:600;">${escapeHtml(publicRef)}</span>
            </td>
          </tr>
        </table>
      </td>
    </tr>`;
}

function infoBox(params: {
  companyName: string;
  route: string;
  date: string;
  statusLine: string;
  passengers: FlightPassenger[];
}) {
  const paxHtml = passengerLines(params.passengers)
    .map(
      (line) => `
        <tr>
          <td style="padding:8px 0 0;color:#111827;font-size:14px;line-height:1.6;">
            <span style="display:inline-block;width:18px;color:#2563eb;font-weight:700;">&#9679;</span>
            ${line}
          </td>
        </tr>`
    )
    .join("");

  return `
    <table width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0;border:1px solid #bfdbfe;border-radius:12px;background:#f8fbff;">
      <tr>
        <td style="padding:20px 24px;">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td style="padding-bottom:12px;color:#2563eb;font-size:14px;font-weight:600;">
                &#10003; ${escapeHtml(params.companyName)} guarantees your tickets will be issued
              </td>
            </tr>
            <tr>
              <td style="font-size:22px;font-weight:700;color:#111827;line-height:1.3;">
                ${escapeHtml(params.route)}${params.date ? ` | ${escapeHtml(params.date)}` : ""}
              </td>
            </tr>
            <tr>
              <td style="padding-top:8px;color:#4b5563;font-size:14px;line-height:1.6;">
                ${params.statusLine}
              </td>
            </tr>
            <tr>
              <td style="padding-top:16px;border-top:1px solid #dbeafe;">
                <table width="100%" cellpadding="0" cellspacing="0">${paxHtml}</table>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>`;
}

function paymentFlightSection(params: {
  flight: FlightBooking;
  segments: FlightSegment[];
  totalAmount: number;
}) {
  const { rows, total } = paymentRows(params.flight, params.totalAmount);
  const rowHtml = rows
    .map(
      (row) => `
        <tr>
          <td style="padding:8px 0;color:#4b5563;font-size:14px;">${row.label}</td>
          <td align="right" style="padding:8px 0;color:#111827;font-size:14px;">${row.value}</td>
        </tr>`
    )
    .join("");

  return `
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:8px;">
      <tr>
        <td style="padding:0 0 12px;font-size:18px;font-weight:700;color:#111827;">Payment &amp; Flight Info</td>
      </tr>
      <tr>
        <td>
          <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e7eb;border-radius:12px;">
            <tr>
              <td style="padding:20px 24px;">
                <table width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="font-size:24px;font-weight:700;color:#111827;">Total</td>
                    <td align="right" style="font-size:24px;font-weight:700;color:#111827;">${total}</td>
                  </tr>
                  <tr>
                    <td colspan="2" style="padding:12px 0;border-bottom:1px solid #e5e7eb;"></td>
                  </tr>
                  ${rowHtml}
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:0 24px 20px;border-top:1px solid #e5e7eb;">
                <table width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="padding:16px 0 8px;color:#9ca3af;font-size:12px;">* All departure/arrival times are in local time.</td>
                  </tr>
                  ${flightLegsHtml(params.segments, params.flight.airline, params.flight.cabinClass)}
                </table>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>`;
}

export function buildHotelConfirmedEmailHtml(params: {
  agency: AgencySettings;
  booking: Booking;
  customer: Customer;
  hotel: HotelBooking;
}) {
  const { agency, booking, customer, hotel } = params;
  const customerName = escapeHtml(toTitleCase(customer.name));
  const confirmation = escapeHtml(booking.pnr || hotel.confirmationNo || "Pending");

  const body = `
    ${headerRow(agency.companyName, booking.publicRef)}
    <tr>
      <td style="padding:28px 32px 0;">
        <h1 style="margin:0 0 20px;font-size:30px;line-height:1.2;font-weight:700;color:#111827;">Your booking has been confirmed</h1>
        <p style="margin:0 0 16px;font-size:15px;line-height:1.7;color:#374151;">
          Dear <strong>${customerName}</strong>,
        </p>
        <p style="margin:0 0 16px;font-size:15px;line-height:1.7;color:#374151;">
          Thank you for booking with <strong>${escapeHtml(agency.companyName)}</strong>.
          Your hotel voucher and invoice are attached to this email.
        </p>
      </td>
    </tr>
    <tr>
      <td style="padding:0 32px;">
        <table width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0;border:1px solid #bfdbfe;border-radius:12px;background:#f8fbff;">
          <tr>
            <td style="padding:20px 24px;">
              <div style="font-size:22px;font-weight:700;color:#111827;">${escapeHtml(hotel.propertyName)}</div>
              <div style="padding-top:8px;color:#4b5563;font-size:14px;">${escapeHtml(hotel.city || "")}</div>
              <div style="padding-top:12px;color:#4b5563;font-size:14px;">
                Check-in: <strong>${escapeHtml(hotel.checkIn ? format(new Date(hotel.checkIn), "MMM d, yyyy") : "—")}</strong>
                · Check-out: <strong>${escapeHtml(hotel.checkOut ? format(new Date(hotel.checkOut), "MMM d, yyyy") : "—")}</strong>
              </div>
              <div style="padding-top:12px;color:#2563eb;font-size:14px;font-weight:600;">
                Confirmation: ${confirmation}
              </div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
    <tr>
      <td style="padding:8px 32px 24px;">
        <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e7eb;border-radius:12px;">
          <tr>
            <td style="padding:20px 24px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="font-size:24px;font-weight:700;">Total</td>
                  <td align="right" style="font-size:24px;font-weight:700;">${formatInr(Number(booking.totalAmount))}</td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>`;

  return emailShell(body, agency.companyName, agency.phone);
}
