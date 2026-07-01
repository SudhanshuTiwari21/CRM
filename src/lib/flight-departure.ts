import { addHours, differenceInHours } from "date-fns";
import type { FlightSegment } from "@/types/booking";
import { flightDateTimeToDate } from "@/lib/flight-datetime";

export function getEarliestDeparture(segments: FlightSegment[]): Date | null {
  const times = segments
    .map((s) => (s.departureAt ? flightDateTimeToDate(s.departureAt) : null))
    .filter((d): d is Date => d !== null && !Number.isNaN(d.getTime()));

  if (times.length === 0) return null;
  return new Date(Math.min(...times.map((d) => d.getTime())));
}

export function hoursUntilDeparture(departure: Date, from = new Date()) {
  return differenceInHours(departure, from);
}

export function isDepartureWithin48Hours(departure: Date, from = new Date()) {
  const hours = hoursUntilDeparture(departure, from);
  return hours > 0 && hours <= 48;
}

export function isDueForCheckInAssistanceNotification(departure: Date, from = new Date()) {
  const hours = hoursUntilDeparture(departure, from);
  // Notify when within 48h of departure (cron hourly; also catches bookings made late)
  return hours > 0 && hours <= 48;
}

export function upcoming48HourWindow(from = new Date()) {
  return { from, to: addHours(from, 48) };
}
