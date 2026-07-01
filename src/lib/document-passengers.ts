import type { BusPassenger, FlightPassenger, HotelGuest } from "@/types/booking";

type BookingPassengerSource = {
  customer?: { name: string } | null;
  flightBooking?: { passengers: unknown } | null;
  hotelBooking?: { guests: unknown } | null;
  busBooking?: { passengers: unknown } | null;
};

export function collectPassengerNames(booking: BookingPassengerSource): string[] {
  const names = new Set<string>();

  if (booking.customer?.name?.trim()) {
    names.add(booking.customer.name.trim());
  }

  const flightPassengers = (booking.flightBooking?.passengers as FlightPassenger[] | undefined) || [];
  for (const p of flightPassengers) {
    const label = `${p.firstName || ""} ${p.lastName || ""}`.trim();
    if (label) names.add(label);
  }

  const hotelGuests = (booking.hotelBooking?.guests as HotelGuest[] | undefined) || [];
  for (const g of hotelGuests) {
    if (g.name?.trim()) names.add(g.name.trim());
  }

  const busPassengers = (booking.busBooking?.passengers as BusPassenger[] | undefined) || [];
  for (const p of busPassengers) {
    if (p.name?.trim()) names.add(p.name.trim());
  }

  return [...names];
}

export function bookingMatchesPassengerSearch(booking: BookingPassengerSource, query: string) {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return collectPassengerNames(booking).some((name) => name.toLowerCase().includes(q));
}
