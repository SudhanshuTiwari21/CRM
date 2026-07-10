import { format } from "date-fns";
import type { AgencySettings, Booking, Customer, FlightBooking, HotelBooking, BusBooking } from "@prisma/client";
import type { FlightSegment } from "@/types/booking";
import {
  buildFullRoute,
  buildSectorLegs,
  buildSectorSummary,
  connectionGapText,
  connectionGapTitle,
  itineraryBadgeLabel,
  layoverDisplay,
} from "@/lib/flight-layover";

function firstName(name: string) {
  const part = name.trim().split(/\s+/)[0];
  return part || "Guest";
}

function formatWhatsAppDate(date: Date | string) {
  const d = typeof date === "string" ? new Date(date) : date;
  return format(d, "dd-MMM-yyyy, EEEE");
}

function mapsDirectionsUrl(address: string, city?: string | null) {
  const query = [address, city].filter(Boolean).join(", ");
  return `http://maps.google.com/maps?q=${encodeURIComponent(query)}`;
}

function formatInr(amount: number) {
  return `Rs. ${amount.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
}

function buildSector(segments: FlightSegment[], tripType?: string | null) {
  return buildSectorSummary(segments, tripType);
}

function buildTravelDate(segments: FlightSegment[]) {
  const first = segments[0];
  if (!first?.departureAt) return "-";
  return formatWhatsAppDate(first.departureAt);
}

export function buildHotelConfirmedMessage(params: {
  agency: AgencySettings;
  booking: Booking;
  customer: Customer;
  hotel: HotelBooking;
}) {
  const { agency, booking, customer, hotel } = params;
  const propertyLabel = hotel.city ? `${hotel.propertyName}, ${hotel.city}` : hotel.propertyName;
  const directions = mapsDirectionsUrl(hotel.propertyAddress, hotel.city);
  const propertyPhone = hotel.propertyPhone?.trim() || "-";

  const cancellation =
    hotel.includeCancellationPolicy && hotel.cancellationPolicy
      ? hotel.cancellationPolicy
      : hotel.cancellationPolicy || "Please contact us for cancellation terms.";

  const lines = [
    `*Dear ${firstName(customer.name)}*,`,
    "",
    `Thank you for choosing ${agency.companyName}. Your booking for ${propertyLabel} is *confirmed* 👍`,
    "",
    `*Booking ID*: ${booking.publicRef}`,
    "",
    `*Property Name*: ${propertyLabel}`,
    "",
    `*Check-in Date & Time*: ${formatWhatsAppDate(hotel.checkIn)}, ${hotel.checkInTime} (Destination Time)`,
    "",
    `*Check-out Date & Time*: ${formatWhatsAppDate(hotel.checkOut)}, ${hotel.checkOutTime} (Destination Time)`,
    "",
    `*Room Type*: ${hotel.roomType} • ${hotel.nights} night(s) • ${hotel.roomsCount} room(s)`,
    "",
    `*Property Directions*: ${directions}`,
    "",
    `*Property Phone Number*: ${propertyPhone}`,
    "",
    `*Cancellation Policy*: ${cancellation}`,
    "",
    hotel.inclusions ? `*Inclusions*: ${hotel.inclusions}` : null,
    "",
    `*Amount*: ${formatInr(Number(booking.totalAmount))}`,
    "",
    "Your voucher and invoice have been sent to your email.",
    "",
    "We wish you a comfortable stay",
    "",
    `Team ${agency.companyName}`,
  ];

  return lines.filter((l) => l !== null).join("\n");
}

export function buildFlightConfirmedMessage(params: {
  agency: AgencySettings;
  booking: Booking;
  customer: Customer;
  flight: FlightBooking;
}) {
  const { agency, booking, customer, flight } = params;
  const segments = flight.segments as unknown as FlightSegment[];
  const passengers = flight.passengers as unknown as { firstName: string; lastName: string }[];
  const paxCount = passengers.length;

  const lines = [
    `*Dear ${firstName(customer.name)}*,`,
    "",
    `Thank you for choosing ${agency.companyName}. Your flight booking is *confirmed* 👍`,
    "",
    `*Booking ID*: ${booking.publicRef}`,
    "",
    `*PNR*: ${booking.pnr || "-"}`,
    flight.secondaryPnr ? `*Return PNR*: ${flight.secondaryPnr}` : null,
    "",
    `*Airline*: ${flight.airline}`,
    "",
    `*Route*: ${buildFullRoute(segments)} (${itineraryBadgeLabel(flight.tripType, segments)})`,
    "",
    `*Sector*: ${buildSector(segments, flight.tripType)}`,
    "",
    ...buildSectorLegs(segments, flight.tripType).map(
      (leg) => `*${leg.label}*: ${leg.sector} - ${leg.cities}${leg.date ? ` (${leg.date})` : ""}`
    ),
    "",
    `*Travel Date*: ${buildTravelDate(segments)}`,
    flight.tripType !== "ROUND_TRIP" && segments.length > 1 && segments[0]
      ? `*Layover*: ${layoverDisplay(segments[0], segments[1]) || "See e-ticket for connection details"}`
      : null,
    "",
    `*Passengers*: ${paxCount}`,
    "",
    `*Amount*: ${formatInr(Number(booking.totalAmount))}`,
    "",
    "Your e-ticket and invoice have been sent to your email.",
    "",
    "We wish you a pleasant journey",
    "",
    `Team ${agency.companyName}`,
  ];

  return lines.filter((l) => l !== null).join("\n");
}

export function buildFlightItineraryMessage(params: {
  agency: AgencySettings;
  booking: Booking;
  customer: Customer;
  flight: FlightBooking;
}) {
  const { agency, booking, customer, flight } = params;
  const segments = flight.segments as unknown as FlightSegment[];
  const passengers = flight.passengers as unknown as { firstName: string; lastName: string }[];
  const paxCount = passengers.length;

  const lines = [
    `*Dear ${firstName(customer.name)}*,`,
    "",
    `Thank you for choosing ${agency.companyName}. Your flight *itinerary* is ready ✈️`,
    "",
    `*Booking ID*: ${booking.publicRef}`,
    "",
    `*PNR*: Pending - will be shared once confirmed`,
    "",
    `*Airline*: ${flight.airline}`,
    "",
    `*Route*: ${buildFullRoute(segments)} (${itineraryBadgeLabel(flight.tripType, segments)})`,
    "",
    `*Sector*: ${buildSector(segments, flight.tripType)}`,
    "",
    `*Travel Date*: ${buildTravelDate(segments)}`,
    "",
    `*Passengers*: ${paxCount}`,
    "",
    `*Amount*: ${formatInr(Number(booking.totalAmount))}`,
    "",
    ...(flight.includeCancellationPolicy && flight.cancellationPolicy
      ? [`*Cancellation Policy*: ${flight.cancellationPolicy}`, ""]
      : []),
    "Your booking voucher and invoice have been sent to your email.",
    "",
    "We will send a separate confirmation with your PNR once the airline confirms.",
    "",
    `Team ${agency.companyName}`,
  ];

  return lines.join("\n");
}

export function buildBusConfirmedMessage(params: {
  agency: AgencySettings;
  booking: Booking;
  customer: Customer;
  bus: BusBooking;
}) {
  const { agency, booking, customer, bus } = params;
  const passengers = bus.passengers as unknown as { name: string; seat: string }[];

  const lines = [
    `*Dear ${firstName(customer.name)}*,`,
    "",
    `Thank you for choosing ${agency.companyName}. Your bus booking is *confirmed* 👍`,
    "",
    `*Booking ID*: ${booking.publicRef}`,
    "",
    `*Operator*: ${bus.operator}`,
    "",
    `*Route*: ${bus.route}`,
    "",
    `*Boarding*: ${bus.boardingPoint}`,
    "",
    `*Dropping*: ${bus.droppingPoint}`,
    "",
    `*Departure*: ${formatWhatsAppDate(bus.departureAt)}`,
    "",
    `*Passengers*: ${passengers.map((p) => `${p.name} (Seat ${p.seat})`).join(", ")}`,
    "",
    `*Amount*: ${formatInr(Number(booking.totalAmount))}`,
    "",
    "Your ticket and invoice have been sent to your email.",
    "",
    "We wish you a safe journey",
    "",
    `Team ${agency.companyName}`,
  ];

  return lines.join("\n");
}

export function buildGenericConfirmedMessage(params: {
  agency: AgencySettings;
  booking: Booking;
  customer: Customer;
}) {
  const { agency, booking, customer } = params;

  return [
    `*Dear ${firstName(customer.name)}*,`,
    "",
    `Thank you for choosing ${agency.companyName}. Your ${booking.productType.toLowerCase()} booking is *confirmed* 👍`,
    "",
    `*Booking ID*: ${booking.publicRef}`,
    booking.pnr ? `*PNR / Confirmation*: ${booking.pnr}` : null,
    "",
    `*Amount*: ${formatInr(Number(booking.totalAmount))}`,
    "",
    "Your documents have been sent to your email.",
    "",
    `Team ${agency.companyName}`,
  ]
    .filter((l) => l !== null)
    .join("\n");
}
