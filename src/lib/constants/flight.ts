export const CABIN_CLASS_OPTIONS = [
  { value: "ECONOMY", label: "Economy" },
  { value: "PREMIUM_ECONOMY", label: "Premium Economy" },
  { value: "BUSINESS", label: "Business" },
] as const;

export const FARE_TYPE_OPTIONS = [
  { value: "NORMAL", label: "Normal" },
  { value: "CORP", label: "CORP" },
  { value: "FLEXI", label: "Flexi" },
  { value: "UPFRONT", label: "Upfront" },
] as const;

export function fareTypeLabel(value?: string | null) {
  return FARE_TYPE_OPTIONS.find((o) => o.value === value)?.label || value || "Normal";
}

export const TRIP_TYPE_OPTIONS = [
  { value: "ONE_WAY", label: "One Way" },
  { value: "ROUND_TRIP", label: "Round Trip" },
  { value: "MULTI_CITY", label: "Multi City" },
  { value: "ADDON_SERVICES", label: "Add-on Services" },
] as const;

export const FLIGHT_ROUTE_TYPE_OPTIONS = [
  { value: "DOMESTIC", label: "Domestic" },
  { value: "INTERNATIONAL", label: "International" },
] as const;

export const ADDON_TYPE_OPTIONS = [
  { value: "seat", label: "Seat Add-on" },
  { value: "food", label: "Food Add-on" },
  { value: "custom", label: "Other (Custom)" },
] as const;

export const BAGGAGE_PRESETS = [
  "15 KG",
  "20 KG",
  "23 KG x 1",
  "23 KG x 2",
  "1 Pc",
  "2 Pc",
  "Custom",
] as const;

export const CABIN_BAGGAGE_PRESETS = ["7 KG", "10 KG", "Custom"] as const;

export const PAX_TYPE_OPTIONS = [
  { value: "adult", label: "Adult (12+)" },
  { value: "child", label: "Child (2–12 yrs)" },
  { value: "infant", label: "Infant (under 2 yrs)" },
] as const;

export const MEAL_OPTIONS = [
  { value: "veg", label: "Veg" },
  { value: "nonveg", label: "Non-Veg" },
  { value: "none", label: "No Meal" },
] as const;

export const CUSTOMER_TITLE_OPTIONS = [
  { value: "Mr", label: "Mr" },
  { value: "Mrs", label: "Mrs" },
  { value: "Ms", label: "Ms" },
  { value: "Mstr", label: "Mstr" },
  { value: "Miss", label: "Miss" },
  { value: "Dr", label: "Dr" },
  { value: "Prof", label: "Prof" },
] as const;

export const LAYOVER_TYPE_OPTIONS = [
  { value: "connection", label: "Connection / Layover" },
  { value: "plane_change", label: "Change of Aircraft" },
  { value: "technical", label: "Technical Stop" },
] as const;

export const STOP_COUNT_OPTIONS = [
  { value: 0, label: "Non-stop" },
  { value: 1, label: "1 Stop" },
  { value: 2, label: "2 Stops" },
  { value: 3, label: "3 Stops" },
] as const;

export const COMMON_AIRLINES = [
  { name: "IndiGo", iata: "6E" },
  { name: "SpiceJet", iata: "SG" },
  { name: "Air India", iata: "AI" },
  { name: "Vistara", iata: "UK" },
  { name: "Akasa Air", iata: "QP" },
  { name: "Go First", iata: "G8" },
  { name: "AirAsia India", iata: "I5" },
  { name: "Alliance Air", iata: "9I" },
] as const;
