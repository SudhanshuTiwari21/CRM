import type { AddonType } from "@prisma/client";
import type { FlightPassenger, FlightSegment } from "@/types/booking";
import { ADDON_TYPE_OPTIONS } from "@/lib/constants/flight";

export type AddonTypeForm = (typeof ADDON_TYPE_OPTIONS)[number]["value"];

export function toDbAddonType(value?: AddonTypeForm | null): AddonType | null {
  if (!value) return null;
  return value.toUpperCase() as AddonType;
}

export function fromDbAddonType(value?: AddonType | null): AddonTypeForm | undefined {
  if (!value) return undefined;
  return value.toLowerCase() as AddonTypeForm;
}

export function addonTypeLabel(
  addonType?: AddonType | AddonTypeForm | null,
  customLabel?: string | null
): string {
  const key = typeof addonType === "string" ? addonType.toLowerCase() : "";
  if (key === "custom" && customLabel?.trim()) return customLabel.trim();
  const match = ADDON_TYPE_OPTIONS.find((o) => o.value === key);
  return match?.label || "Add-on Service";
}

export function buildAddonPlaceholderSegment(
  airline: string,
  flightNumber?: string,
  travelDate?: string
): FlightSegment {
  const when = travelDate?.trim() || new Date().toISOString();
  return {
    flightNumber: flightNumber?.trim() || "ADDON",
    airline,
    fromAirport: "ADD",
    fromCity: "Add-on Service",
    toAirport: "ADD",
    toCity: "Add-on Service",
    departureAt: when,
    arrivalAt: when,
  };
}

export function validateAddonBooking(
  addonType: AddonTypeForm | undefined,
  passengers: FlightPassenger[],
  addonCustomLabel?: string,
  addonCustomValue?: string
) {
  if (!addonType) throw new Error("Select add-on service type");

  if (addonType === "seat") {
    const hasSeat = passengers.some((p) => p.seat?.trim());
    if (!hasSeat) throw new Error("Enter seat number for the passenger");
  }

  if (addonType === "food") {
    const hasMeal = passengers.some((p) => p.meal && p.meal !== "none");
    if (!hasMeal) throw new Error("Select meal preference for the passenger");
  }

  if (addonType === "custom") {
    if (!addonCustomLabel?.trim()) throw new Error("Enter a label for the custom add-on");
    if (!addonCustomValue?.trim()) throw new Error("Enter details for the custom add-on");
  }
}

export function addonDetailLines(
  addonType: AddonType | AddonTypeForm | null | undefined,
  customLabel?: string | null,
  customValue?: string | null,
  passengers: FlightPassenger[] = []
): string[] {
  const type = typeof addonType === "string" ? addonType.toUpperCase() : "";
  const lines: string[] = [`Service: ${addonTypeLabel(addonType, customLabel)}`];

  passengers.forEach((p) => {
    const name = `${p.title} ${p.firstName} ${p.lastName}`.trim();
    if (p.seat?.trim()) {
      lines.push(`Seat${name ? ` — ${name}` : ""}: ${p.seat.trim()}`);
    }
  });

  if (type === "FOOD") {
    passengers.forEach((p) => {
      if (p.meal && p.meal !== "none") {
        const meal = p.meal === "veg" ? "Veg" : "Non-Veg";
        lines.push(`Meal — ${p.title} ${p.firstName} ${p.lastName}: ${meal}`);
      }
    });
  } else if (type === "CUSTOM") {
    if (customValue?.trim()) lines.push(`Details: ${customValue.trim()}`);
  }

  return lines;
}
