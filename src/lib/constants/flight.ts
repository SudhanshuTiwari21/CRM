export const CABIN_CLASS_OPTIONS = [
  { value: "ECONOMY", label: "Economy" },
  { value: "PREMIUM_ECONOMY", label: "Premium Economy" },
  { value: "BUSINESS", label: "Business" },
] as const;

export const TRIP_TYPE_OPTIONS = [
  { value: "ONE_WAY", label: "One Way" },
  { value: "ROUND_TRIP", label: "Round Trip" },
  { value: "MULTI_CITY", label: "Multi City" },
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
