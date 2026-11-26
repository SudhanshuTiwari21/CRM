import { format } from "date-fns";
import type { BrandId } from "@/lib/branding";
import type { FlightPassenger, FlightSegment, HotelGuest } from "@/types/booking";
import { passengerDisplayName } from "@/lib/flight-fare-breakup";
import { getReturnLegStartIndex } from "@/lib/flight-layover";
import { travelerDisplayName } from "@/lib/voucher-format";

/** Safe for disk / Content-Disposition filenames. */
export function sanitizePdfBaseName(raw: string) {
  return raw
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[. ]+$/g, "")
    .slice(0, 140);
}

function formatTravelDate(value?: string | Date | null) {
  if (!value) return "TBD";
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "TBD";
  return format(d, "dd-MMM-yyyy");
}

function flightSectorLabel(segments: FlightSegment[], tripType?: string | null) {
  if (!segments.length) return "Flight";
  const first = segments[0];
  let lastOutbound = segments[segments.length - 1];
  if (tripType === "ROUND_TRIP" && segments.length >= 2) {
    const splitAt = getReturnLegStartIndex(segments);
    lastOutbound = segments[Math.max(splitAt - 1, 0)] || first;
  }
  const from = (first.fromAirport || first.fromCity || "XXX").toUpperCase();
  const to = (lastOutbound.toAirport || lastOutbound.toCity || "XXX").toUpperCase();
  return `${from}-${to}`;
}

function primaryFlightPassengerName(
  passengers: FlightPassenger[],
  fallback?: string | null
) {
  const named = passengers.find((p) => passengerDisplayName(p).trim());
  if (named) return travelerDisplayName(named);
  return (fallback || "Passenger").trim();
}

function primaryHotelGuestName(guests: HotelGuest[], fallback?: string | null) {
  const named = guests.find((g) => g.name?.trim());
  if (named?.name?.trim()) return named.name.trim();
  return (fallback || "Guest").trim();
}

function withBrandSuffix(base: string, kind: string, brandId: BrandId) {
  const safe = sanitizePdfBaseName(base) || kind;
  return `${safe} - ${kind}-${brandId}.pdf`;
}

/** Sector-Sector - date of travel - passenger name */
export function flightTicketPdfFileName(params: {
  segments: FlightSegment[];
  tripType?: string | null;
  passengers: FlightPassenger[];
  customerName?: string | null;
  brandId: BrandId;
}) {
  const sector = flightSectorLabel(params.segments, params.tripType);
  const travelDate = formatTravelDate(params.segments[0]?.departureAt);
  const pax = primaryFlightPassengerName(params.passengers, params.customerName);
  return withBrandSuffix(`${sector} - ${travelDate} - ${pax}`, "ticket", params.brandId);
}

/** Hotel Name - Check in date - Passenger Name */
export function hotelVoucherPdfFileName(params: {
  propertyName: string;
  checkIn: Date | string;
  guests: HotelGuest[];
  customerName?: string | null;
  brandId: BrandId;
}) {
  const hotel = params.propertyName.trim() || "Hotel";
  const checkIn = formatTravelDate(params.checkIn);
  const guest = primaryHotelGuestName(params.guests, params.customerName);
  return withBrandSuffix(`${hotel} - ${checkIn} - ${guest}`, "voucher", params.brandId);
}

export function brandedPdfName(publicRef: string, kind: string, brandId: BrandId) {
  return `${sanitizePdfBaseName(publicRef)}-${kind}-${brandId}.pdf`;
}
