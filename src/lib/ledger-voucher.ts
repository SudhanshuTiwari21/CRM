import type { FlightBooking, HotelBooking, BusBooking } from "@prisma/client";
import type { FlightSegment } from "@/types/booking";
import { buildSectorSummary } from "@/lib/flight-layover";
import { passengerDisplayName } from "@/lib/flight-fare-breakup";
import type { FlightPassenger } from "@/types/booking";

export function formatLedgerVoucherNo(booking: {
  publicRef: string;
  serialYear?: number | null;
  serialNumber?: number | null;
}) {
  if (booking.serialNumber != null && booking.serialYear != null) {
    return `TRVL${booking.serialNumber}/${String(booking.serialYear).slice(-2)}`;
  }
  const parsed = /^FB-(\d{4})-(\d+)$/.exec(booking.publicRef);
  if (parsed) {
    return `TRVL${Number(parsed[2])}/${parsed[1].slice(-2)}`;
  }
  return booking.publicRef;
}

function flightPassengerNames(flight: FlightBooking | null | undefined): string {
  if (!flight?.passengers) return "";
  const passengers = flight.passengers as unknown as FlightPassenger[];
  const names = passengers.map(passengerDisplayName).filter(Boolean);
  if (names.length === 0) return "";
  if (names.length <= 2) return names.join(", ");
  return `${names[0]}, ${names[1]} +${names.length - 2}`;
}

export function buildSaleBookingTypeLines(
  productType: string,
  flight: FlightBooking | null | undefined,
  hotel: HotelBooking | null | undefined,
  bus: BusBooking | null | undefined
): string[] {
  const lines: string[] = [productType];

  if (productType === "FLIGHT" && flight) {
    const segments = (flight.segments || []) as unknown as FlightSegment[];
    const sector = buildSectorSummary(segments, flight.tripType);
    if (sector) lines.push(`SECTOR ${sector}`);
    const pax = flightPassengerNames(flight);
    if (pax) lines.push(pax.toUpperCase());
    if (flight.invoiceNarration?.trim()) {
      lines.push(flight.invoiceNarration.trim());
    }
  } else if (productType === "HOTEL" && hotel) {
    if (hotel.city) lines.push(hotel.city.toUpperCase());
    lines.push(hotel.propertyName);
  } else if (productType === "BUS" && bus) {
    lines.push(bus.route);
  }

  return lines;
}

export function buildPaymentBookingTypeLines(
  againstVoucher: string | null,
  onAccount: boolean
): string[] {
  if (onAccount) return ["PAYMENT", "ON ACCOUNT"];
  return ["PAYMENT", againstVoucher || "-"];
}
