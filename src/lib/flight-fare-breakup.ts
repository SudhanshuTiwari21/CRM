import type { FlightPassenger } from "@/types/booking";

export function isAdultPassenger(p: FlightPassenger): boolean {
  return (p.paxType || "adult") === "adult";
}

export function getAdultPassengers(passengers: FlightPassenger[]): FlightPassenger[] {
  const adults = passengers.filter(isAdultPassenger);
  return adults.length > 0 ? adults : passengers.slice(0, 1);
}

export function sumAdultBaseFares(passengers: FlightPassenger[]): number {
  return getAdultPassengers(passengers).reduce((sum, p) => sum + Number(p.baseFare || 0), 0);
}

export interface AdultFareLine {
  passenger: FlightPassenger;
  amount: number;
}

/** Per-adult fare lines for invoice; splits total evenly when per-pax fares are not stored. */
export function buildAdultBaseFareLines(
  passengers: FlightPassenger[],
  totalBaseFare: number
): AdultFareLine[] {
  const adults = getAdultPassengers(passengers);
  if (adults.length === 0) return [];

  const hasPerPax = adults.some((p) => p.baseFare != null && Number(p.baseFare) > 0);
  if (hasPerPax) {
    return adults.map((p) => ({ passenger: p, amount: Number(p.baseFare || 0) }));
  }

  if (totalBaseFare <= 0) return adults.map((p) => ({ passenger: p, amount: 0 }));

  const each = Math.round((totalBaseFare / adults.length) * 100) / 100;
  const lines = adults.map((p, i) => ({
    passenger: p,
    amount: i === adults.length - 1 ? round2(totalBaseFare - each * (adults.length - 1)) : each,
  }));
  return lines;
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

export function passengerDisplayName(p: FlightPassenger): string {
  return [p.firstName, p.lastName].filter(Boolean).join(" ").trim();
}
