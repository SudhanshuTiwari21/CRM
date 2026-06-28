import type { FlightPassenger } from "@/types/booking";

export function passengerHasFrequentFlyer(p: FlightPassenger): boolean {
  return Boolean(p.frequentFlyerAirline?.trim() || p.frequentFlyerNumber?.trim());
}

export function bookingHasFrequentFlyer(passengers: FlightPassenger[]): boolean {
  return passengers.some(passengerHasFrequentFlyer);
}

export function freqFlyerStatusLabel(
  productType: string,
  passengers: FlightPassenger[],
  updatedToAirline: boolean
): "yes" | "no" | "na" {
  if (productType !== "FLIGHT" || !bookingHasFrequentFlyer(passengers)) return "na";
  return updatedToAirline ? "yes" : "no";
}
