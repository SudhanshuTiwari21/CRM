/**
 * Flight times are wall-clock values (what the agent enters), not UTC instants.
 * Store as YYYY-MM-DDTHH:mm and never shift via browser/server timezone.
 */

const NAIVE_DT_RE = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/;
const LEGACY_TZ = "Asia/Kolkata";

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const WEEKDAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

export type FlightWallClock = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
};

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

export function formatWallClockLocal(parts: FlightWallClock) {
  return `${parts.year}-${pad2(parts.month)}-${pad2(parts.day)}T${pad2(parts.hour)}:${pad2(parts.minute)}`;
}

export function parseFlightDateTime(value?: string | null): FlightWallClock | null {
  if (!value?.trim()) return null;
  const trimmed = value.trim();

  const naive = NAIVE_DT_RE.exec(trimmed);
  if (naive) {
    return {
      year: Number(naive[1]),
      month: Number(naive[2]),
      day: Number(naive[3]),
      hour: Number(naive[4]),
      minute: Number(naive[5]),
    };
  }

  const d = new Date(trimmed);
  if (Number.isNaN(d.getTime())) return null;

  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: LEGACY_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(d);

  const pick = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return {
    year: Number(pick("year")),
    month: Number(pick("month")),
    day: Number(pick("day")),
    hour: Number(pick("hour")),
    minute: Number(pick("minute")),
  };
}

export function normalizeFlightDateTime(value: string) {
  const parts = parseFlightDateTime(value);
  if (!parts) return value.trim();
  return formatWallClockLocal(parts);
}

export function normalizeFlightSegments<T extends { departureAt?: string; arrivalAt?: string }>(
  segments: T[]
): T[] {
  return segments.map((segment) => ({
    ...segment,
    departureAt: segment.departureAt ? normalizeFlightDateTime(segment.departureAt) : segment.departureAt,
    arrivalAt: segment.arrivalAt ? normalizeFlightDateTime(segment.arrivalAt) : segment.arrivalAt,
  }));
}

export function toDatetimeLocalValue(value?: string | null) {
  if (!value?.trim()) return "";
  const parts = parseFlightDateTime(value);
  return parts ? formatWallClockLocal(parts) : "";
}

export function flightDateTimeToDate(value: string) {
  const parts = parseFlightDateTime(value);
  if (!parts) return new Date(value);
  return new Date(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, 0, 0);
}

export function formatFlightWallClock(
  value?: string | null,
  style: "voucher" | "display" | "trip" | "short" = "voucher"
) {
  const parts = parseFlightDateTime(value);
  if (!parts) return "—";

  const weekday = WEEKDAY_NAMES[new Date(parts.year, parts.month - 1, parts.day).getDay()];

  switch (style) {
    case "voucher":
      return `${pad2(parts.hour)}:${pad2(parts.minute)} ${parts.day} ${MONTH_NAMES[parts.month - 1]} ${parts.year}, ${weekday}`;
    case "trip":
      return `${pad2(parts.hour)}:${pad2(parts.minute)}, ${MONTH_NAMES[parts.month - 1]} ${parts.day}, ${parts.year}`;
    case "short":
      return `${MONTH_NAMES[parts.month - 1]?.slice(0, 3)} ${parts.day}`;
    case "display":
    default:
      return `${pad2(parts.day)}/${pad2(parts.month)}/${parts.year}, ${pad2(parts.hour)}:${pad2(parts.minute)}`;
  }
}
