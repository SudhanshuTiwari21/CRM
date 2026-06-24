import { prisma } from "@/lib/db";
import { getEarliestDeparture, upcoming48HourWindow } from "@/lib/flight-departure";
import type { FlightSegment } from "@/types/booking";

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
