import { format } from "date-fns";
import type { CabinClass } from "@prisma/client";
import type { FlightPassenger, FlightSegment } from "@/types/booking";
import { getAirportDisplay } from "@/lib/airport-names";
import { computeLayoverDuration, getReturnLegStartIndex } from "@/lib/flight-layover";
import { formatFlightWallClock } from "@/lib/flight-datetime";

export function formatVoucherDateTime(date: Date | string) {
  if (typeof date === "string") {
    return formatFlightWallClock(date, "voucher");
  }
  return formatFlightWallClock(date.toISOString(), "voucher");
}

export function formatVoucherDob(isoDate?: string | null) {
  if (!isoDate?.trim()) return "-";
  const d = new Date(isoDate);
  if (Number.isNaN(d.getTime())) return isoDate;
  return format(d, "d MMM yyyy");
}

export function airportLine(city: string, code: string, fallbackCity?: string, terminal?: string) {
  const entry = getAirportDisplay(code, fallbackCity || city);
  const name = entry.airportLine.includes(" - ")
    ? entry.airportLine.split(" - ").slice(1).join(" - ")
    : `${entry.city} Airport`;
  const terminalSuffix = terminal
    ? terminal.toLowerCase().startsWith("terminal")
      ? ` - ${terminal}`
      : ` - Terminal ${terminal.replace(/^T/i, "")}`
    : "";
  return `${entry.city}, ${name}${terminalSuffix}`;
}

export function formatEndpoint(seg: FlightSegment, kind: "departure" | "arrival") {
  const isDep = kind === "departure";
  const at = isDep ? seg.departureAt : seg.arrivalAt;
  if (!at) return "-";
  const city = isDep ? seg.fromCity : seg.toCity;
  const code = isDep ? seg.fromAirport : seg.toAirport;
  const terminal = isDep ? seg.departureTerminal : seg.terminal;
  return `${formatVoucherDateTime(at)} - ${airportLine(city, code, city, terminal)}`;
}

export function paxTypeLabel(type?: string) {
  if (type === "child") return "Child";
  if (type === "infant") return "Infant";
  return "Adult";
}

export function cabinLabel(cabin?: CabinClass | string | null) {
  if (cabin === "BUSINESS") return "Business";
  if (cabin === "PREMIUM_ECONOMY") return "Premium Economy";
  return "Economy";
}

/** Wingie-style class column e.g. "Economy - T" */
export function cabinClassDisplay(cabin?: CabinClass | string | null) {
  const base = cabinLabel(cabin);
  if (base === "Economy") return "Economy - T";
  return base;
}

export function travelerDisplayName(pax: FlightPassenger) {
  return `${pax.firstName} ${pax.lastName || ""}`.trim();
}

export function layoverLabel(seg: FlightSegment, next: FlightSegment) {
  const raw = seg.layoverDuration || computeLayoverDuration(seg.arrivalAt, next.departureAt);
  if (!raw) return "Stop : Layover";
  return `Stop : ${raw} Layover`;
}

export function formatCabinBaggageLine(handBaggage?: string) {
  if (!handBaggage?.trim()) return null;
  const preset = handBaggage.trim().match(/^(\d+)\s*KG$/i);
  if (preset) return `1 piece X ${preset[1]} kg cabin baggage`;
  return handBaggage.trim();
}

export function baggageLines(pax: FlightPassenger) {
  const lines: string[] = [];
  const cabin = formatCabinBaggageLine(pax.handBaggage);
  if (cabin) lines.push(cabin);
  if (pax.checkInBaggage) lines.push(pax.checkInBaggage);
  else lines.push("1 piece X 15 kg checked baggage");
  return lines;
}

export function groupSegments(segments: FlightSegment[], tripType?: string | null) {
  if (tripType !== "ROUND_TRIP" || segments.length < 2) {
    const from = segments[0]?.fromCity || segments[0]?.fromAirport || "";
    const to = segments[segments.length - 1]?.toCity || segments[segments.length - 1]?.toAirport || "";
    return [{ label: `Departure: ${from}-${to}`, segments }];
  }
  const splitAt = getReturnLegStartIndex(segments);
  const outbound = segments.slice(0, splitAt);
  const ret = segments.slice(splitAt);
  const groups: { label: string; segments: FlightSegment[] }[] = [];
  if (outbound.length) {
    const o = outbound;
    groups.push({
      label: `Departure: ${o[0].fromCity || o[0].fromAirport}-${o[o.length - 1].toCity || o[o.length - 1].toAirport}`,
      segments: o,
    });
  }
  if (ret.length) {
    const r = ret;
    groups.push({
      label: `Return: ${r[0].fromCity || r[0].fromAirport}-${r[r.length - 1].toCity || r[r.length - 1].toAirport}`,
      segments: r,
    });
  }
  return groups.length ? groups : [{ label: "Departure", segments }];
}

export function voucherPaymentBreakdown(params: {
  baseFare: number;
  serviceCharge: number;
  taxes: number;
  discount: number;
  total: number;
}) {
  const priceBeforeTax = params.baseFare + params.serviceCharge;
  return {
    price: priceBeforeTax,
    taxes: params.taxes,
    discount: params.discount,
    total: params.total,
  };
}

export function formatVoucherInr(amount: number, useRupeeSymbol = true) {
  const formatted = amount.toLocaleString("en-IN", { minimumFractionDigits: 1, maximumFractionDigits: 2 });
  return useRupeeSymbol ? `₹ ${formatted}` : `Rs. ${formatted}`;
}

/** PDF-safe INR - Helvetica in @react-pdf renders ₹ as a superscript "1". */
export function formatPdfInr(amount: number) {
  return formatVoucherInr(amount, false);
}

export const WINGIE_COLORS = {
  navy: "#1a2d3e",
  text: "#2a3a4a",
  label: "#8a96a3",
  muted: "#9aa5b1",
  border: "#d8dee6",
  paymentBg: "#f5f5f5",
  termsBorder: "#7dd3d8",
} as const;
