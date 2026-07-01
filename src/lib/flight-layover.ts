import { differenceInMinutes } from "date-fns";
import type { FlightSegment } from "@/types/booking";
import { flightDateTimeToDate, formatFlightWallClock } from "@/lib/flight-datetime";

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
  const mins = differenceInMinutes(
    flightDateTimeToDate(nextDepartureAt),
    flightDateTimeToDate(arrivalAt)
  );
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
/** Index of the first return leg segment in a round-trip itinerary. */
export function getReturnLegStartIndex(segments: FlightSegment[]) {
  const idx = segments.findIndex((s) => s.direction === "return");
  if (idx !== -1) return idx;
  return segments.length >= 2 ? 1 : segments.length;
}

export function isRoundTripLegBoundary(segments: FlightSegment[], segmentIndex: number) {
  const splitAt = getReturnLegStartIndex(segments);
  return segmentIndex === splitAt - 1;
}

export function buildSectorSummary(segments: FlightSegment[], tripType?: string | null) {
  if (!segments.length) return "";

  if (tripType === "ROUND_TRIP" && segments.length >= 2) {
    const splitAt = getReturnLegStartIndex(segments);
    const outbound = segments.slice(0, splitAt);
    const ret = segments.slice(splitAt);
    const parts: string[] = [];
    if (outbound.length) {
      parts.push(
        `Outbound: ${outbound[0].fromAirport}-${outbound[outbound.length - 1].toAirport}`
      );
    }
    if (ret.length) {
      parts.push(`Return: ${ret[0].fromAirport}-${ret[ret.length - 1].toAirport}`);
    }
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

  if (tripType === "ROUND_TRIP") {
    const splitAt = getReturnLegStartIndex(segments);
    return segments.map((s, i) => {
      const isReturn = i >= splitAt;
      const legIndex = isReturn ? i - splitAt + 1 : i + 1;
      const legCount = isReturn ? segments.length - splitAt : splitAt;
      const prefix = isReturn ? "Return" : "Outbound";
      const legLabel = legCount === 1 ? prefix : `${prefix} Leg ${legIndex}`;
      return {
        label: legLabel,
        sector: `${s.fromAirport}-${s.toAirport}`,
        cities: `${s.fromCity} → ${s.toCity}`,
        date: s.departureAt ? formatFlightWallClock(s.departureAt, "display") : "",
        flight: s.flightNumber,
      };
    });
  }

  return segments.map((s, i) => {
    const legLabel = segments.length > 1 ? `Leg ${i + 1}` : "Flight";
    return {
      label: legLabel,
      sector: `${s.fromAirport}-${s.toAirport}`,
      cities: `${s.fromCity} → ${s.toCity}`,
      date: s.departureAt ? formatFlightWallClock(s.departureAt, "display") : "",
      flight: s.flightNumber,
    };
  });
}

export function itineraryBadgeLabel(tripType?: string | null, segments: FlightSegment[] = []) {
  if (tripType === "ADDON_SERVICES") return "Add-on Services";
  if (tripType === "ROUND_TRIP") return "Round Trip";
  if (tripType === "MULTI_CITY") return "Multi City";
  return stopsLabel(segments);
}

export function connectionGapTitle(
  tripType: string | null | undefined,
  segmentIndex: number,
  segments?: FlightSegment[]
) {
  if (
    tripType === "ROUND_TRIP" &&
    segments &&
    isRoundTripLegBoundary(segments, segmentIndex)
  ) {
    return "Return Journey";
  }
  return "Stop / Layover";
}

export function connectionGapText(
  seg: FlightSegment,
  nextSeg: FlightSegment,
  tripType?: string | null,
  segmentIndex?: number,
  segments?: FlightSegment[]
) {
  if (
    tripType === "ROUND_TRIP" &&
    segments &&
    segmentIndex != null &&
    isRoundTripLegBoundary(segments, segmentIndex)
  ) {
    const dep = nextSeg.departureAt ? formatFlightWallClock(nextSeg.departureAt, "display") : "";
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
  const mins = differenceInMinutes(
    flightDateTimeToDate(seg.arrivalAt),
    flightDateTimeToDate(seg.departureAt)
  );
  if (mins <= 0) return "—";
  return formatLayoverMinutes(mins);
}

export function formatFlightDateTime(iso: string) {
  return formatFlightWallClock(iso, "display");
}
