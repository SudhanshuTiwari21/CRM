import { getAirportDisplay } from "@/lib/airport-names";
import { COMMON_AIRLINES } from "@/lib/constants/flight";
import { inferAirlineNameFromFlightNumber } from "@/lib/airline-logo";

export type ParsedProductType = "FLIGHT" | "HOTEL" | "BUS";

export type ParsedFlightSegment = {
  flightNumber: string;
  airline: string;
  fromAirport: string;
  fromCity: string;
  toAirport: string;
  toCity: string;
  departureAt: string;
  arrivalAt: string;
  pnr?: string;
  terminal?: string;
  departureTerminal?: string;
};

export type ParsedFlightPassenger = {
  title: string;
  firstName: string;
  lastName: string;
  gender: string;
  paxType: "adult" | "child" | "infant";
  ticketNumber?: string;
  seat?: string;
};

export type ParsedTicketResult = {
  productType: ParsedProductType;
  confidence: "high" | "medium" | "low";
  warnings: string[];
  /** Fields to merge into the offline booking wizard */
  fields: Record<string, unknown>;
  rawTextPreview: string;
};

const MONTH_MAP: Record<string, number> = {
  jan: 1,
  january: 1,
  feb: 2,
  february: 2,
  mar: 3,
  march: 3,
  apr: 4,
  april: 4,
  may: 5,
  jun: 6,
  june: 6,
  jul: 7,
  july: 7,
  aug: 8,
  august: 8,
  sep: 9,
  sept: 9,
  september: 9,
  oct: 10,
  october: 10,
  nov: 11,
  november: 11,
  dec: 12,
  december: 12,
};

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

/** Normalize extracted wall-clock to YYYY-MM-DDTHH:mm */
export function toFormDateTime(raw: string | null | undefined): string {
  if (!raw?.trim()) return "";
  const s = raw.trim().replace(/\s+/g, " ");

  // 2026-08-28T18:45 or 2026-08-28 18:45
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})[T\s](\d{1,2}):(\d{2})/);
  if (m) {
    return `${m[1]}-${m[2]}-${m[3]}T${pad2(Number(m[4]))}:${m[5]}`;
  }

  // 28/08/2026 18:45 or 28-08-2026, 6:45 PM
  m = s.match(
    /^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})(?:[,\s]+(\d{1,2}):(\d{2})(?:\s*([AaPp][Mm]))?)?/
  );
  if (m) {
    let hour = Number(m[4] || 0);
    const minute = Number(m[5] || 0);
    const ampm = m[6]?.toUpperCase();
    if (ampm === "PM" && hour < 12) hour += 12;
    if (ampm === "AM" && hour === 12) hour = 0;
    return `${m[3]}-${pad2(Number(m[2]))}-${pad2(Number(m[1]))}T${pad2(hour)}:${pad2(minute)}`;
  }

  // 28 Aug 2026 18:45 / 28 August 2026, 06:45 PM
  m = s.match(
    /^(\d{1,2})\s+([A-Za-z]{3,9})\s+(\d{4})(?:[,\s]+(\d{1,2}):(\d{2})(?:\s*([AaPp][Mm]))?)?/
  );
  if (m) {
    const month = MONTH_MAP[m[2].toLowerCase()];
    if (!month) return "";
    let hour = Number(m[4] || 0);
    const minute = Number(m[5] || 0);
    const ampm = m[6]?.toUpperCase();
    if (ampm === "PM" && hour < 12) hour += 12;
    if (ampm === "AM" && hour === 12) hour = 0;
    return `${m[3]}-${pad2(month)}-${pad2(Number(m[1]))}T${pad2(hour)}:${pad2(minute)}`;
  }

  // Date only DD/MM/YYYY
  m = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/);
  if (m) {
    return `${m[3]}-${pad2(Number(m[2]))}-${pad2(Number(m[1]))}T00:00`;
  }

  // Date only 28 Aug 2026
  m = s.match(/^(\d{1,2})\s+([A-Za-z]{3,9})\s+(\d{4})$/);
  if (m) {
    const month = MONTH_MAP[m[2].toLowerCase()];
    if (!month) return "";
    return `${m[3]}-${pad2(month)}-${pad2(Number(m[1]))}T00:00`;
  }

  return "";
}

function sanitizeCaptured(value: string) {
  return value
    .split(/\n/)[0]
    .replace(/\s+/g, " ")
    .replace(/\s+(?:PNR|Ticket|Passenger|Seat|Total|Amount|Phone|Email|City|Room|Check|Departure|Arrival|Fare|No\.?|Number)\b.*$/i, "")
    .trim();
}

function firstMatch(text: string, patterns: RegExp[]): string | undefined {
  for (const re of patterns) {
    const m = text.match(re);
    if (m?.[1]?.trim()) {
      const cleaned = sanitizeCaptured(m[1]);
      if (cleaned) return cleaned;
    }
  }
  return undefined;
}

function allMatches(text: string, re: RegExp): string[] {
  const out: string[] = [];
  const flags = re.flags.includes("g") ? re.flags : `${re.flags}g`;
  const global = new RegExp(re.source, flags);
  let m: RegExpExecArray | null;
  while ((m = global.exec(text)) !== null) {
    if (m[1]?.trim()) out.push(m[1].trim());
  }
  return out;
}

function detectProductType(text: string, hint?: ParsedProductType): ParsedProductType {
  const lower = text.toLowerCase();
  const scores: Record<ParsedProductType, number> = { FLIGHT: 0, HOTEL: 0, BUS: 0 };

  if (/\bpnr\b|e-?ticket|boarding\s*pass|flight\s*no|airline|departure\s*airport|iata/i.test(text)) {
    scores.FLIGHT += 3;
  }
  if (/\b(6e|ai|uk|sg|qp|indigo|spicejet|air\s*india|vistara|akasa)\b/i.test(text)) {
    scores.FLIGHT += 2;
  }
  if (/\b(check[\s-]?in|check[\s-]?out|hotel|property|room\s*type|guest\s*name|nights?\b)/i.test(text)) {
    scores.HOTEL += 3;
  }
  if (/\b(redbus|intrcity|bus\s*ticket|boarding\s*point|dropping\s*point|operator|seat\s*no)/i.test(text)) {
    scores.BUS += 3;
  }
  if (/\bPNR\b|\b[A-Z]{2}\s?\d{2,4}\b/.test(text) && /airport/i.test(lower)) scores.FLIGHT += 1;

  const best = (Object.entries(scores) as [ParsedProductType, number][]).sort((a, b) => b[1] - a[1])[0];
  if (hint && scores[hint] >= best[1] - 1) return hint;
  if (best[1] === 0 && hint) return hint;
  return best[0];
}

function parsePassengerName(raw: string): { title: string; firstName: string; lastName: string; gender: string } {
  let name = sanitizeCaptured(raw);
  name = name.replace(/^(passenger|pax|guest|traveller|traveler|primary\s*guest|lead\s*guest)\s*[:\-]?\s*/i, "");
  name = name.replace(/\d{10,}/g, "").trim();
  name = name.replace(/\b(?:ADT|CHD|INF|Adult|Child|Infant)\b.*$/i, "").trim();

  // LASTNAME/FIRSTNAME or LASTNAME, FIRSTNAME
  const slash = name.match(/^([A-Za-z]+)\s*[\/,]\s*([A-Za-z]+(?:\s+[A-Za-z]+)?)$/);
  if (slash) {
    return { title: "Mr", firstName: titleCase(slash[2]), lastName: titleCase(slash[1]), gender: "Male" };
  }

  let title = "Mr";
  let gender = "Male";
  const titleMatch = name.match(/^(Mr|Mrs|Ms|Miss|Mstr|Master|Dr|Prof)\.?\s+/i);
  if (titleMatch) {
    const t = titleMatch[1];
    title = t.toLowerCase() === "master" ? "Mstr" : t.charAt(0).toUpperCase() + t.slice(1).toLowerCase();
    if (title === "Mrs" || title === "Ms" || title === "Miss") gender = "Female";
    name = name.slice(titleMatch[0].length).trim();
  }

  const parts = name.split(/\s+/).filter((w) => /^[A-Za-z]+$/.test(w));
  if (parts.length === 0) return { title, firstName: "", lastName: "", gender };
  if (parts.length === 1) return { title, firstName: titleCase(parts[0]), lastName: "", gender };
  return {
    title,
    firstName: titleCase(parts[0]),
    lastName: titleCase(parts.slice(1).join(" ")),
    gender,
  };
}

function titleCase(s: string) {
  return s
    .toLowerCase()
    .split(/\s+/)
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : ""))
    .join(" ");
}

function extractAmount(text: string): number | undefined {
  const m = text.match(
    /(?:total\s*(?:fare|amount|price)?|grand\s*total|amount\s*payable|net\s*fare)\s*[:\-]?\s*(?:INR|Rs\.?|₹)?\s*([\d,]+(?:\.\d{1,2})?)/i
  );
  if (!m) {
    const fallback = text.match(/(?:INR|Rs\.?|₹)\s*([\d,]+(?:\.\d{1,2})?)/i);
    if (!fallback) return undefined;
    return Number(fallback[1].replace(/,/g, ""));
  }
  return Number(m[1].replace(/,/g, ""));
}

function extractPhone(text: string): string | undefined {
  const m = text.match(/(?:\+91[\s-]?)?([6-9]\d{9})\b/);
  return m?.[1];
}

function extractEmail(text: string): string | undefined {
  const m = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  return m?.[0]?.toLowerCase();
}

function extractPnr(text: string): string | undefined {
  return firstMatch(text, [
    /(?:PNR|Booking\s*(?:Ref(?:erence)?|ID|Code)|Confirmation\s*(?:No|Number|Code)|Airline\s*PNR)\s*[:\-]?\s*([A-Z0-9]{5,8})\b/i,
    /\bPNR\s+([A-Z0-9]{6})\b/i,
  ]);
}

function extractFlightNumbers(text: string): string[] {
  const iata = COMMON_AIRLINES.map((a) => a.iata).join("|");
  const re = new RegExp(`\\b((?:${iata}|[A-Z]{2})[\\s-]?\\d{2,4})\\b`, "gi");
  const found = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const normalized = m[1].replace(/\s+/g, "").toUpperCase().replace(/^([A-Z0-9]{2})(\d+)$/, "$1$2");
    // Skip false positives like "IN 2026" years — flight nums usually have airline+digits
    if (/^(IN|OR|TO|AT|ON)\d+$/i.test(normalized)) continue;
    found.add(normalized.replace(/^([A-Z0-9]{2})(\d+)$/, "$1$2"));
  }
  return [...found];
}

const MONTH_ABBREV = new Set([
  "JAN",
  "FEB",
  "MAR",
  "APR",
  "MAY",
  "JUN",
  "JUL",
  "AUG",
  "SEP",
  "OCT",
  "NOV",
  "DEC",
]);

function isPlausibleAirportCode(code: string) {
  const c = code.toUpperCase();
  if (!/^[A-Z]{3}$/.test(c)) return false;
  if (MONTH_ABBREV.has(c)) return false;
  if (["PNR", "INR", "USD", "GST", "PDF", "SMS", "ETA", "ETD", "UTC", "URE"].includes(c)) return false;
  return true;
}

function extractAirportPairs(text: string): { from: string; to: string }[] {
  const pairs: { from: string; to: string }[] = [];
  const re =
    /\b([A-Z]{3})\s*(?:\([^)]{0,40}\))?\s*(?:→|->|–|—|to|TO)\s*([A-Z]{3})\b/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m[1] !== m[2] && isPlausibleAirportCode(m[1]) && isPlausibleAirportCode(m[2])) {
      pairs.push({ from: m[1], to: m[2] });
    }
  }

  // Prefer full words — avoid matching "depart" inside "Departure"
  const fromCodes = allMatches(
    text,
    /(?:\bfrom\b|\bdeparture\s*airport\b|\borigin\b)\s*[:\-]?\s*([A-Z]{3})\b/gi
  ).filter(isPlausibleAirportCode);
  const toCodes = allMatches(
    text,
    /(?:\bto\b|\barrival\s*airport\b|\bdestination\b)\s*[:\-]?\s*([A-Z]{3})\b/gi
  ).filter(isPlausibleAirportCode);
  for (let i = 0; i < Math.min(fromCodes.length, toCodes.length); i++) {
    if (fromCodes[i] !== toCodes[i]) {
      pairs.push({ from: fromCodes[i].toUpperCase(), to: toCodes[i].toUpperCase() });
    }
  }

  const seen = new Set<string>();
  return pairs.filter((p) => {
    const key = `${p.from}-${p.to}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function extractDateTimes(text: string): string[] {
  const results: string[] = [];
  const patterns = [
    /(\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\s+\d{4}(?:[,\s]+\d{1,2}:\d{2}(?:\s*[AaPp][Mm])?)?)/gi,
    /(\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{4}(?:[,\s]+\d{1,2}:\d{2}(?:\s*[AaPp][Mm])?)?)/g,
    /(\d{4}-\d{2}-\d{2}[T\s]\d{1,2}:\d{2})/g,
  ];
  for (const re of patterns) {
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      const normalized = toFormDateTime(m[1]);
      if (normalized) results.push(normalized);
    }
  }
  return results;
}

function parseFlight(text: string): ParsedTicketResult {
  const warnings: string[] = [];
  const pnr = extractPnr(text);
  const flightNumbers = extractFlightNumbers(text);
  const pairs = extractAirportPairs(text);
  const dateTimes = extractDateTimes(text);
  const amount = extractAmount(text);
  const phone = extractPhone(text);
  const email = extractEmail(text);

  let airline =
    firstMatch(text, [
      /(?:airline|carrier)\s*[:\-]?\s*([A-Za-z][A-Za-z ]{1,30}?)(?:\s*(?:\n|$|PNR|Flight|Booking))/i,
      ...COMMON_AIRLINES.map((a) => new RegExp(`\\b(${a.name.replace(/\s+/g, "\\s+")})\\b`, "i")),
    ]) || "";
  airline = sanitizeCaptured(airline).replace(/\s+/g, " ").trim();
  if (!airline && flightNumbers[0]) {
    airline = inferAirlineNameFromFlightNumber(flightNumbers[0]) || "";
  }
  if (!airline) airline = "IndiGo";

  const segments: ParsedFlightSegment[] = [];
  const segCount = Math.max(flightNumbers.length, pairs.length, 1);
  for (let i = 0; i < segCount; i++) {
    const fn = flightNumbers[i] || flightNumbers[0] || "";
    const pair = pairs[i] || pairs[0];
    const fromAirport = pair?.from || "";
    const toAirport = pair?.to || "";
    const fromCity = fromAirport ? getAirportDisplay(fromAirport).city : "";
    const toCity = toAirport ? getAirportDisplay(toAirport).city : "";
    const departureAt = dateTimes[i * 2] || dateTimes[0] || "";
    const arrivalAt = dateTimes[i * 2 + 1] || dateTimes[1] || "";
    segments.push({
      flightNumber: fn.replace(/^([A-Z0-9]{2})(\d+)$/, "$1$2"),
      airline: inferAirlineNameFromFlightNumber(fn) || airline,
      fromAirport,
      fromCity,
      toAirport,
      toCity,
      departureAt,
      arrivalAt,
      pnr: i === 0 ? pnr : undefined,
    });
  }

  if (!flightNumbers.length) warnings.push("Could not detect flight number");
  if (!pairs.length) warnings.push("Could not detect airport codes");
  if (!pnr) warnings.push("Could not detect PNR");

  // Passengers
  const passengers: ParsedFlightPassenger[] = [];
  const paxLines = [
    ...allMatches(text, /(?:passenger|pax|traveller|traveler)\s*(?:name)?\s*[:\-]?\s*([^\n]{3,60})/gi),
    ...allMatches(text, /\b((?:Mr|Mrs|Ms|Miss|Mstr|Master|Dr)\.?\s+[A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+){0,3})\b/g),
    ...allMatches(text, /\b([A-Z]{2,}(?:\s+[A-Z]{2,}){1,3})\s+(?:ADT|CHD|INF|Adult|Child)\b/g),
  ].map(sanitizeCaptured);
  const ticketNumbers = allMatches(text, /(?:ticket\s*(?:no|number)?\s*[:\-]?\s*)((?:\d{3}[\s-]?)?\d{10})\b/gi).filter(
    (t) => t.replace(/\D/g, "").length >= 10
  );

  const seenNames = new Set<string>();
  for (const line of paxLines) {
    const parsed = parsePassengerName(line);
    if (!parsed.firstName || parsed.firstName.length < 2) continue;
    const key = `${parsed.firstName}|${parsed.lastName}`.toLowerCase();
    if (seenNames.has(key)) continue;
    // Skip airport/city false positives
    if (/delhi|mumbai|kolkata|airport|terminal|indigo|spicejet/i.test(key)) continue;
    seenNames.add(key);
    passengers.push({
      ...parsed,
      paxType: /child|chd/i.test(line) ? "child" : /infant|inf/i.test(line) ? "infant" : "adult",
      ticketNumber: ticketNumbers[passengers.length],
    });
  }

  if (!passengers.length) {
    warnings.push("Could not detect passenger names — please enter manually");
    passengers.push({
      title: "Mr",
      firstName: "",
      lastName: "",
      gender: "Male",
      paxType: "adult",
      ticketNumber: ticketNumbers[0],
    });
  }

  const tripType = segments.length > 1 ? "ROUND_TRIP" : "ONE_WAY";
  const customerName = passengers[0]
    ? [passengers[0].firstName, passengers[0].lastName].filter(Boolean).join(" ")
    : "";

  const fields: Record<string, unknown> = {
    productType: "FLIGHT",
    airline,
    tripType,
    cabinClass: /business/i.test(text) ? "BUSINESS" : /premium/i.test(text) ? "PREMIUM_ECONOMY" : "ECONOMY",
    segments,
    passengers: passengers.map((p) => ({
      ...p,
      handBaggage: "7 KG",
      cabinBaggagePreset: "7 KG",
      dateOfBirth: "",
      passportNumber: "",
      passportIssuingCountry: "",
      passportIssueDate: "",
      passportExpiryDate: "",
    })),
    stopCount: Math.max(0, segments.length - 1),
    returnStopCount: 0,
  };

  if (amount && amount > 0) {
    fields.baseFare = amount;
    fields.totalAmount = amount;
  }
  if (customerName) {
    fields.customer = {
      title: passengers[0]?.title || "Mr",
      name: customerName,
      phone: phone || "",
      email: email || "",
    };
  } else if (phone || email) {
    fields.customer = { phone: phone || "", email: email || "" };
  }

  const confidence: ParsedTicketResult["confidence"] =
    flightNumbers.length && pairs.length ? "high" : flightNumbers.length || pairs.length ? "medium" : "low";

  return {
    productType: "FLIGHT",
    confidence,
    warnings,
    fields,
    rawTextPreview: text.slice(0, 500),
  };
}

function parseHotel(text: string): ParsedTicketResult {
  const warnings: string[] = [];
  const propertyName =
    firstMatch(text, [
      /(?:hotel|property|resort)\s*name\s*[:\-]?\s*([^\n]{3,80})/i,
      /(?:confirmation\s*for|booking\s*at)\s*([^\n]{3,80})/i,
      /(?:^|\n)\s*(?:hotel|property|resort)\s*[:\-]?\s*([^\n]{3,80})/i,
    ]) || "";
  const confirmation =
    firstMatch(text, [
      /(?:confirmation|booking)\s*(?:no|number|id|code|ref(?:erence)?)\s*[:\-]?\s*([A-Z0-9-]{5,20})/i,
    ]) || "";
  const checkInRaw = firstMatch(text, [
    /check[\s-]?in\s*(?:date)?\s*[:\-]?\s*([^\n]{6,40})/i,
    /arrival\s*(?:date)?\s*[:\-]?\s*([^\n]{6,40})/i,
  ]);
  const checkOutRaw = firstMatch(text, [
    /check[\s-]?out\s*(?:date)?\s*[:\-]?\s*([^\n]{6,40})/i,
    /departure\s*(?:date)?\s*[:\-]?\s*([^\n]{6,40})/i,
  ]);
  const roomType = firstMatch(text, [/room\s*(?:type)?\s*[:\-]?\s*([^\n]{3,60})/i]) || "";
  const city = firstMatch(text, [/\bcity\s*[:\-]?\s*([A-Za-z .]{2,40})/i]) || "";
  const address = firstMatch(text, [/(?:address|location)\s*[:\-]?\s*([^\n]{5,120})/i]) || "";
  const amount = extractAmount(text);
  const phone = extractPhone(text);
  const email = extractEmail(text);

  const guestNames = [
    ...allMatches(text, /(?:guest|primary\s*guest|lead\s*guest)\s*(?:name)?\s*[:\-]?\s*([^\n]{3,60})/gi),
    ...allMatches(text, /\b((?:Mr|Mrs|Ms|Miss|Dr)\.?\s+[A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+){0,3})\b/g),
  ].map(sanitizeCaptured);

  const guests = guestNames
    .map((n) => {
      const p = parsePassengerName(n);
      const name = [p.firstName, p.lastName].filter(Boolean).join(" ");
      return name ? { name, type: "adult" as const } : null;
    })
    .filter(Boolean) as { name: string; type: "adult" | "child" }[];

  const uniqueGuests: { name: string; type: "adult" | "child" }[] = [];
  const seenGuests = new Set<string>();
  for (const g of guests) {
    const key = g.name.toLowerCase();
    if (seenGuests.has(key)) continue;
    seenGuests.add(key);
    uniqueGuests.push(g);
  }

  if (!propertyName) warnings.push("Could not detect hotel name");
  if (!checkInRaw) warnings.push("Could not detect check-in date");
  if (!uniqueGuests.length) warnings.push("Could not detect guest names");

  const checkInDt = toFormDateTime(checkInRaw);
  const checkOutDt = toFormDateTime(checkOutRaw);
  // Hotel form uses date string for checkIn/checkOut often as datetime-local or date - wizard uses checkIn/checkOut strings
  const checkIn = checkInDt ? checkInDt.slice(0, 10) : "";
  const checkOut = checkOutDt ? checkOutDt.slice(0, 10) : "";

  const fields: Record<string, unknown> = {
    productType: "HOTEL",
    propertyName: propertyName.replace(/\s+/g, " ").trim(),
    propertyAddress: address,
    city,
    roomType: roomType.replace(/\s+/g, " ").trim(),
    checkIn,
    checkOut,
    roomsCount: 1,
    adultsCount: Math.max(1, uniqueGuests.length),
    childrenCount: 0,
    guests: uniqueGuests.length ? uniqueGuests : [{ name: "", type: "adult" }],
    inclusions: confirmation ? `Confirmation: ${confirmation}` : "",
  };
  if (amount && amount > 0) fields.totalAmount = amount;
  if (uniqueGuests[0]?.name) {
    fields.customer = {
      title: "Mr",
      name: uniqueGuests[0].name,
      phone: phone || "",
      email: email || "",
    };
  }

  return {
    productType: "HOTEL",
    confidence: propertyName && checkIn ? "high" : propertyName || checkIn ? "medium" : "low",
    warnings,
    fields,
    rawTextPreview: text.slice(0, 500),
  };
}

function parseBus(text: string): ParsedTicketResult {
  const warnings: string[] = [];
  const operator =
    firstMatch(text, [
      /(?:operator|bus\s*operator|travel(?:s)?)\s*[:\-]?\s*([^\n]{2,60})/i,
      /\b(RedBus|IntrCity|AbhiBus|MakeMyTrip|Goibibo)\b/i,
    ]) || "";
  const route =
    firstMatch(text, [
      /(?:route|from\s*[-–to]+\s*)\s*[:\-]?\s*([^\n]{5,80})/i,
      /\b([A-Za-z .]{3,30})\s*(?:→|->|to|TO)\s*([A-Za-z .]{3,30})\b/,
    ]) || "";
  // Fix route if captured as two groups poorly
  let routeValue = route;
  const routePair = text.match(/\b([A-Za-z .]{3,30})\s*(?:→|->|–|-|to|TO)\s*([A-Za-z .]{3,30})\b/);
  if (routePair && !/boarding|dropping|seat/i.test(routePair[0])) {
    routeValue = `${routePair[1].trim()} - ${routePair[2].trim()}`;
  }

  const boardingPoint =
    firstMatch(text, [/(?:boarding\s*(?:point|from)|pickup)\s*[:\-]?\s*([^\n]{3,80})/i]) || "";
  const droppingPoint =
    firstMatch(text, [/(?:dropping\s*(?:point|at)|drop\s*(?:point|off)|destination)\s*[:\-]?\s*([^\n]{3,80})/i]) ||
    "";
  const dateTimes = extractDateTimes(text);
  const amount = extractAmount(text);
  const phone = extractPhone(text);
  const email = extractEmail(text);

  const seatNumbers = allMatches(text, /(?:seat(?:\s*no(?:\.|umber)?)?)\s*[:\-]?\s*([A-Z0-9]{1,4})\b/gi)
    .map((s) => s.trim().toUpperCase())
    .filter((s) => /^[A-Z0-9]{1,4}$/i.test(s) && !/^(FARE|INR|NO|SEAT)$/i.test(s));

  const paxNames = [
    ...allMatches(text, /(?:passenger|pax)\s*(?:name)?\s*[:\-]?\s*([^\n]{3,60})/gi),
    ...allMatches(text, /\b((?:Mr|Mrs|Ms|Miss|Dr)\.?\s+[A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+){0,3})\b/g),
  ].map(sanitizeCaptured);

  const busPassengers = paxNames
    .map((n, i) => {
      const p = parsePassengerName(n);
      const name = [p.firstName, p.lastName].filter(Boolean).join(" ");
      if (!name) return null;
      return { name, seat: seatNumbers[i] || "", gender: p.gender };
    })
    .filter(Boolean) as { name: string; seat: string; gender?: string }[];

  const uniqueBusPax: { name: string; seat: string; gender?: string }[] = [];
  const seenBus = new Set<string>();
  for (const p of busPassengers) {
    const key = p.name.toLowerCase();
    if (seenBus.has(key)) continue;
    seenBus.add(key);
    uniqueBusPax.push(p);
  }
  // Assign seats in order if missing
  uniqueBusPax.forEach((p, i) => {
    if (!p.seat && seatNumbers[i]) p.seat = seatNumbers[i];
  });

  if (!operator) warnings.push("Could not detect bus operator");
  if (!boardingPoint && !routeValue) warnings.push("Could not detect route / boarding point");
  if (!uniqueBusPax.length) warnings.push("Could not detect passenger names");

  const fields: Record<string, unknown> = {
    productType: "BUS",
    operator: operator.replace(/\s+/g, " ").trim(),
    route: routeValue.replace(/\s+/g, " ").trim(),
    boardingPoint: boardingPoint.replace(/\s+/g, " ").trim(),
    droppingPoint: droppingPoint.replace(/\s+/g, " ").trim(),
    departureAt: dateTimes[0] || "",
    arrivalAt: dateTimes[1] || "",
    busPassengers: uniqueBusPax.length ? uniqueBusPax : [{ name: "", seat: seatNumbers[0] || "" }],
    seats: (seatNumbers.length ? seatNumbers : [""]).map((seatNumber) => ({ seatNumber })),
  };
  if (amount && amount > 0) fields.totalAmount = amount;
  if (uniqueBusPax[0]?.name) {
    fields.customer = {
      title: "Mr",
      name: uniqueBusPax[0].name,
      phone: phone || "",
      email: email || "",
    };
  }

  return {
    productType: "BUS",
    confidence: operator && (boardingPoint || routeValue) ? "high" : operator || routeValue ? "medium" : "low",
    warnings,
    fields,
    rawTextPreview: text.slice(0, 500),
  };
}

export function parseTicketText(
  text: string,
  hint?: ParsedProductType
): ParsedTicketResult {
  const cleaned = text.replace(/\u0000/g, " ").replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n");
  if (cleaned.trim().length < 20) {
    return {
      productType: hint || "FLIGHT",
      confidence: "low",
      warnings: ["PDF has little or no extractable text. Scanned image tickets are not supported (local text extraction only)."],
      fields: { productType: hint || "FLIGHT" },
      rawTextPreview: cleaned.slice(0, 200),
    };
  }

  const productType = detectProductType(cleaned, hint);
  if (productType === "HOTEL") return parseHotel(cleaned);
  if (productType === "BUS") return parseBus(cleaned);
  return parseFlight(cleaned);
}
