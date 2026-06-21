import { differenceInMinutes, format } from "date-fns";
import type { FlightSegment } from "@/types/booking";

export function formatLayoverMinutes(totalMinutes: number) {
  if (totalMinutes <= 0) return "";
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

export function computeLayoverDuration(arrivalAt: string, nextDepartureAt: string) {
  if (!arrivalAt || !nextDepartureAt) return "";
  const mins = differenceInMinutes(new Date(nextDepartureAt), new Date(arrivalAt));
  if (mins <= 0) return "";
  return formatLayoverMinutes(mins);
}

export function countStops(segments: FlightSegment[]) {
  return Math.max(0, segments.length - 1);
}

export function stopsLabel(segments: FlightSegment[]) {
  const stops = countStops(segments);
  if (stops === 0) return "Non-stop";
  if (stops === 1) return "1 Stop";
  return `${stops} Stops`;
}

export function buildFullRoute(segments: FlightSegment[]) {
  if (!segments.length) return "";
  const points: string[] = [];
  for (const seg of segments) {
    if (!points.length) {
      points.push(seg.fromAirport || seg.fromCity);
    }
    points.push(seg.toAirport || seg.toCity);
  }
  return points.join(" → ");
}

/** Sector string for invoices/tickets — all legs, grouped for round trip. */
export function buildSectorSummary(segments: FlightSegment[], tripType?: string | null) {
  if (!segments.length) return "";

  if (tripType === "ROUND_TRIP" && segments.length >= 2) {
    const parts = segments.map((s, i) => {
      const label =
        s.direction === "return" ? "Return" : s.direction === "outbound" ? "Outbound" : i === 0 ? "Outbound" : "Return";
      return `${label}: ${s.fromAirport}-${s.toAirport}`;
    });
    return parts.join(" | ");
  }

  if (segments.length === 1) {
    const s = segments[0];
    return `${s.fromAirport}-${s.toAirport}`;
  }

  return segments.map((s) => `${s.fromAirport}-${s.toAirport}`).join(" / ");
}

export function buildSectorLegs(segments: FlightSegment[], tripType?: string | null) {
  if (!segments.length) return [];

  return segments.map((s, i) => {
    const legLabel =
      tripType === "ROUND_TRIP"
        ? s.direction === "return" || i === 1
          ? "Return"
          : "Outbound"
        : segments.length > 1
          ? `Leg ${i + 1}`
          : "Flight";
    return {
      label: legLabel,
      sector: `${s.fromAirport}-${s.toAirport}`,
      cities: `${s.fromCity} → ${s.toCity}`,
      date: s.departureAt ? format(new Date(s.departureAt), "dd MMM yyyy") : "",
      flight: s.flightNumber,
    };
  });
}

export function itineraryBadgeLabel(tripType?: string | null, segments: FlightSegment[] = []) {
  if (tripType === "ROUND_TRIP") return "Round Trip";
  if (tripType === "MULTI_CITY") return "Multi City";
  return stopsLabel(segments);
}

export function connectionGapTitle(tripType: string | null | undefined, segmentIndex: number) {
  if (tripType === "ROUND_TRIP" && segmentIndex === 0) return "Return Journey";
  return "Stop / Layover";
}

export function connectionGapText(
  seg: FlightSegment,
  nextSeg: FlightSegment,
  tripType?: string | null,
  segmentIndex?: number
) {
  if (tripType === "ROUND_TRIP" && segmentIndex === 0) {
    const dep = nextSeg.departureAt ? format(new Date(nextSeg.departureAt), "dd MMM yyyy, HH:mm") : "";
    return [
      `Return departs ${nextSeg.fromCity} (${nextSeg.fromAirport})`,
      dep ? `Departure: ${dep}` : null,
      nextSeg.flightNumber ? `Flight: ${nextSeg.flightNumber}` : null,
    ]
      .filter(Boolean)
      .join(" • ");
  }
  return (
    layoverDisplay(seg, nextSeg) || `Connection at ${seg.toCity || seg.toAirport} (${seg.toAirport})`
  );
}

export function layoverCityLabel(seg: FlightSegment) {
  return seg.layoverCity || seg.toCity || seg.toAirport || "Layover";
}

export function layoverDisplay(seg: FlightSegment, nextSeg?: FlightSegment) {
  const duration =
    seg.layoverDuration ||
    (nextSeg ? computeLayoverDuration(seg.arrivalAt, nextSeg.departureAt) : "");
  if (!duration && !seg.layoverTerminal && !seg.layoverNote) return null;

  const city = layoverCityLabel(seg);
  const airport = seg.layoverAirport || seg.toAirport;
  const type =
    seg.layoverType === "plane_change"
      ? "Change of aircraft"
      : seg.layoverType === "technical"
        ? "Technical stop"
        : "Layover / Connection";

  const parts = [`${type} at ${city}${airport ? ` (${airport})` : ""}`];
  if (duration) parts.push(`Duration: ${duration}`);
  if (seg.layoverTerminal) parts.push(`Terminal: ${seg.layoverTerminal}`);
  if (seg.layoverNote) parts.push(seg.layoverNote);
  return parts.join(" • ");
}

export function formatSegmentDuration(seg: FlightSegment) {
  if (seg.duration) return seg.duration;
  if (!seg.departureAt || !seg.arrivalAt) return "—";
  const mins = differenceInMinutes(new Date(seg.arrivalAt), new Date(seg.departureAt));
  if (mins <= 0) return "—";
  return formatLayoverMinutes(mins);
}

export function formatFlightDateTime(iso: string) {
  try {
    return format(new Date(iso), "HH:mm, dd MMM yyyy");
  } catch {
    return iso;
  }
}
