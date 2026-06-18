import { COMMON_AIRLINES } from "@/lib/constants/flight";

const NAME_TO_IATA: Record<string, string> = Object.fromEntries(
  COMMON_AIRLINES.map((a) => [a.name.toLowerCase(), a.iata])
);

/** Resolve IATA from airline name (e.g. "IndiGo" → "6E"). */
export function resolveAirlineIata(airlineName: string): string | null {
  const normalized = airlineName.trim().toLowerCase();
  if (NAME_TO_IATA[normalized]) return NAME_TO_IATA[normalized];

  const match = COMMON_AIRLINES.find(
    (a) => normalized.includes(a.name.toLowerCase()) || a.name.toLowerCase().includes(normalized)
  );
  if (match) return match.iata;

  // 2-letter code typed directly
  if (/^[A-Z0-9]{2}$/i.test(airlineName.trim())) {
    return airlineName.trim().toUpperCase();
  }

  return null;
}

/** Public CDN logo URL for PDF/email use. */
export function getAirlineLogoUrl(airlineName: string): string | null {
  const iata = resolveAirlineIata(airlineName);
  if (!iata) return null;
  return `https://images.kiwi.com/airlines/64/${iata}.png`;
}
