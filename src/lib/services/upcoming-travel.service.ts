import { prisma } from "@/lib/db";
import { getEarliestDeparture, upcoming48HourWindow } from "@/lib/flight-departure";
import type { FlightSegment } from "@/types/booking";

/** Combine hotel check-in date with display time like "02:00 PM". */
export function hotelCheckInAt(checkIn: Date, checkInTime?: string | null): Date {
  const base = new Date(checkIn);
  const raw = (checkInTime || "").trim();
  if (!raw) return base;

  const match = raw.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
  if (!match) return base;

  let hours = Number(match[1]);
  const minutes = Number(match[2]);
  const meridiem = match[3]?.toUpperCase();
  if (meridiem === "PM" && hours < 12) hours += 12;
  if (meridiem === "AM" && hours === 12) hours = 0;

  const at = new Date(base);
  at.setHours(hours, minutes, 0, 0);
  return at;
}

export async function getUpcoming48HourFlightBookings() {
  const { from, to } = upcoming48HourWindow();

  const bookings = await prisma.booking.findMany({
    where: {
      productType: "FLIGHT",
      status: { notIn: ["CANCELLED"] },
      flightBooking: { isNot: null },
    },
    include: {
      customer: { select: { id: true, name: true, phone: true, email: true } },
      flightBooking: true,
      assignedAgent: { select: { name: true } },
    },
  });

  return bookings
    .map((b) => {
      const segments = (b.flightBooking?.segments as unknown as FlightSegment[]) || [];
      const departure =
        b.flightBooking?.earliestDepartureAt || getEarliestDeparture(segments);
      return {
        id: b.id,
        publicRef: b.publicRef,
        pnr: b.pnr,
        status: b.status,
        customer: b.customer,
        assignedAgent: b.assignedAgent,
        airline: b.flightBooking?.airline,
        tripType: b.flightBooking?.tripType,
        segments,
        checkInAssistance: b.flightBooking?.checkInAssistance ?? false,
        checkInAssistanceNotifiedAt: b.flightBooking?.checkInAssistanceNotifiedAt,
        departureAt: departure?.toISOString() ?? null,
        departure,
      };
    })
    .filter((row) => {
      if (!row.departure) return false;
      return row.departure >= from && row.departure <= to;
    })
    .sort((a, b) => (a.departure?.getTime() ?? 0) - (b.departure?.getTime() ?? 0))
    .map(({ departure: _d, ...rest }) => rest);
}

export async function getUpcoming48HourHotelBookings() {
  const { from, to } = upcoming48HourWindow();

  // Pull a slightly wider calendar range, then filter with check-in time.
  const dayFrom = new Date(from);
  dayFrom.setHours(0, 0, 0, 0);
  const dayTo = new Date(to);
  dayTo.setHours(23, 59, 59, 999);

  const bookings = await prisma.booking.findMany({
    where: {
      productType: "HOTEL",
      status: { notIn: ["CANCELLED"] },
      hotelBooking: {
        is: {
          checkIn: { gte: dayFrom, lte: dayTo },
        },
      },
    },
    include: {
      customer: { select: { id: true, name: true, phone: true, email: true } },
      hotelBooking: true,
      assignedAgent: { select: { name: true } },
    },
  });

  return bookings
    .map((b) => {
      const hotel = b.hotelBooking!;
      const checkInAt = hotelCheckInAt(hotel.checkIn, hotel.checkInTime);
      return {
        id: b.id,
        publicRef: b.publicRef,
        pnr: b.pnr,
        status: b.status,
        customer: b.customer,
        assignedAgent: b.assignedAgent,
        propertyName: hotel.propertyName,
        city: hotel.city,
        confirmationNo: hotel.confirmationNo,
        roomType: hotel.roomType,
        roomsCount: hotel.roomsCount,
        adultsCount: hotel.adultsCount,
        childrenCount: hotel.childrenCount,
        checkInTime: hotel.checkInTime,
        checkOut: hotel.checkOut.toISOString(),
        checkInAt: checkInAt.toISOString(),
        checkInAtDate: checkInAt,
        extraServicesOpted: hotel.extraServicesOpted,
        extraServicesNotes: hotel.extraServicesNotes,
        extraServicesNotifiedToHotel: hotel.extraServicesNotifiedToHotel,
        extraServicesNotifiedAt: hotel.extraServicesNotifiedAt?.toISOString() ?? null,
      };
    })
    .filter((row) => row.checkInAtDate >= from && row.checkInAtDate <= to)
    .sort((a, b) => a.checkInAtDate.getTime() - b.checkInAtDate.getTime())
    .map(({ checkInAtDate: _d, ...rest }) => rest);
}

export async function getUpcoming48HourTravel() {
  const [flights, hotels] = await Promise.all([
    getUpcoming48HourFlightBookings(),
    getUpcoming48HourHotelBookings(),
  ]);
  return { flights, hotels };
}
