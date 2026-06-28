import type { FlightPassenger } from "@/types/booking";

export function passengerNeedsWheelchair(p: FlightPassenger): boolean {
  return Boolean(p.wheelchairAssistance);
}

export function bookingNeedsSpecialAssistance(passengers: FlightPassenger[]): boolean {
  return passengers.some(passengerNeedsWheelchair);
}

export function specialAssistanceStatusLabel(
  productType: string,
  passengers: FlightPassenger[],
  updatedToAirline: boolean
): "yes" | "no" | "na" {
  if (productType !== "FLIGHT" || !bookingNeedsSpecialAssistance(passengers)) return "na";
  return updatedToAirline ? "yes" : "no";
}
