import type { FlightPassenger } from "@/types/booking";
import { paxTypeLabel } from "@/lib/voucher-format";

/** Adults and children are included in base-fare reimbursement lines (infants excluded). */
export function isFarePassenger(p: FlightPassenger): boolean {
  const type = p.paxType || "adult";
  return type === "adult" || type === "child";
}

export function isAdultPassenger(p: FlightPassenger): boolean {
  return (p.paxType || "adult") === "adult";
}

export function getFarePassengers(passengers: FlightPassenger[]): FlightPassenger[] {
  const farePax = passengers.filter(isFarePassenger);
  return farePax.length > 0 ? farePax : passengers.slice(0, 1);
}

/** @deprecated Use getFarePassengers — kept for call-site compatibility. */
export function getAdultPassengers(passengers: FlightPassenger[]): FlightPassenger[] {
  return getFarePassengers(passengers);
}

export function sumPassengerBaseFares(passengers: FlightPassenger[]): number {
  return getFarePassengers(passengers).reduce((sum, p) => sum + Number(p.baseFare || 0), 0);
}

/** @deprecated Use sumPassengerBaseFares */
export function sumAdultBaseFares(passengers: FlightPassenger[]): number {
  return sumPassengerBaseFares(passengers);
}

export interface FareLine {
  passenger: FlightPassenger;
  amount: number;
}

/** @deprecated Use FareLine */
export type AdultFareLine = FareLine;

/** Per-passenger fare lines for invoice; splits total evenly when per-pax fares are not stored. */
export function buildBaseFareLines(
  passengers: FlightPassenger[],
  totalBaseFare: number
): FareLine[] {
  const farePax = getFarePassengers(passengers);
  if (farePax.length === 0) return [];

  const hasPerPax = farePax.some((p) => p.baseFare != null && Number(p.baseFare) > 0);
  if (hasPerPax) {
    return farePax.map((p) => ({ passenger: p, amount: Number(p.baseFare || 0) }));
  }

  if (totalBaseFare <= 0) return farePax.map((p) => ({ passenger: p, amount: 0 }));

  const each = Math.round((totalBaseFare / farePax.length) * 100) / 100;
  return farePax.map((p, i) => ({
    passenger: p,
    amount: i === farePax.length - 1 ? round2(totalBaseFare - each * (farePax.length - 1)) : each,
  }));
}

/** @deprecated Use buildBaseFareLines */
export function buildAdultBaseFareLines(
  passengers: FlightPassenger[],
  totalBaseFare: number
): FareLine[] {
  return buildBaseFareLines(passengers, totalBaseFare);
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

export function passengerDisplayName(p: FlightPassenger): string {
  return [p.firstName, p.lastName].filter(Boolean).join(" ").trim();
}

export function passengerFareLabel(p: FlightPassenger, indexAmongType: number): string {
  const name = passengerDisplayName(p);
  const type = paxTypeLabel(p.paxType);
  if (name) return `${name} (${type})`;
  return `${type} ${indexAmongType}`;
}

/** e.g. "1 Adult + 1 Child" or "2 Adults" */
export function farePassengerQtyLabel(lines: FareLine[]): string {
  let adults = 0;
  let children = 0;
  for (const line of lines) {
    if ((line.passenger.paxType || "adult") === "child") children += 1;
    else adults += 1;
  }
  const parts: string[] = [];
  if (adults > 0) parts.push(`${adults} Adult${adults === 1 ? "" : "s"}`);
  if (children > 0) parts.push(`${children} Child${children === 1 ? "" : "ren"}`);
  return parts.join(" + ") || "1 Adult";
}

export function paxTypeUnitLabel(p: FlightPassenger): string {
  return paxTypeLabel(p.paxType);
}
