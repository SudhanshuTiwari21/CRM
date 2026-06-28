import type { FlightPassenger } from "@/types/booking";

export interface SavedPassengerRecord {
  id: string;
  title: string;
  firstName: string;
  lastName: string | null;
  gender: string;
  paxType: string;
  seat: string | null;
  meal: string | null;
  handBaggage: string | null;
  checkInBaggage: string | null;
  baggagePreset: string | null;
  cabinBaggagePreset: string | null;
  frequentFlyerAirline: string | null;
  frequentFlyerNumber: string | null;
  wheelchairAssistance: boolean;
  dateOfBirth: string | null;
  passportNumber: string | null;
  passportIssuingCountry: string | null;
  passportIssueDate: string | null;
  passportExpiryDate: string | null;
  createdAt: string;
  updatedAt: string;
}

export function savedPassengerDisplayName(p: Pick<SavedPassengerRecord, "title" | "firstName" | "lastName">) {
  return [p.title, p.firstName, p.lastName].filter(Boolean).join(" ").trim();
}

export function wizardPassengerToSavePayload(p: WizardFormPassenger) {
  const firstName = p.firstName?.trim();
  if (!firstName) {
    throw new Error("First name is required");
  }
  return {
    title: p.title || "Mr",
    firstName,
    lastName: p.lastName?.trim() || null,
    gender: p.gender || "Male",
    paxType: p.paxType || "adult",
    seat: p.seat?.trim() || null,
    meal: p.meal || null,
    handBaggage: p.handBaggage?.trim() || null,
    checkInBaggage: p.checkInBaggage?.trim() || null,
    baggagePreset: p.baggagePreset?.trim() || null,
    cabinBaggagePreset: p.cabinBaggagePreset?.trim() || null,
    frequentFlyerAirline: p.frequentFlyerAirline?.trim() || null,
    frequentFlyerNumber: p.frequentFlyerNumber?.trim() || null,
    wheelchairAssistance: Boolean(p.wheelchairAssistance),
    dateOfBirth: p.dateOfBirth?.trim() || null,
    passportNumber: p.passportNumber?.trim() || null,
    passportIssuingCountry: p.passportIssuingCountry?.trim() || null,
    passportIssueDate: p.passportIssueDate?.trim() || null,
    passportExpiryDate: p.passportExpiryDate?.trim() || null,
  };
}

type WizardFormPassenger = {
  title?: string;
  firstName?: string;
  lastName?: string;
  gender?: string;
  paxType?: "adult" | "child" | "infant";
  seat?: string;
  meal?: "veg" | "nonveg" | "none";
  handBaggage?: string;
  checkInBaggage?: string;
  baggagePreset?: string;
  cabinBaggagePreset?: string;
  frequentFlyerAirline?: string;
  frequentFlyerNumber?: string;
  wheelchairAssistance?: boolean;
  dateOfBirth?: string;
  passportNumber?: string;
  passportIssuingCountry?: string;
  passportIssueDate?: string;
  passportExpiryDate?: string;
};

export function savedPassengerToWizardValues(
  saved: SavedPassengerRecord
): Partial<WizardFormPassenger> {
  return {
    title: saved.title,
    firstName: saved.firstName,
    lastName: saved.lastName || "",
    gender: saved.gender,
    paxType: saved.paxType as WizardFormPassenger["paxType"],
    seat: saved.seat || "",
    meal: (saved.meal as WizardFormPassenger["meal"]) || "none",
    handBaggage: saved.handBaggage || saved.cabinBaggagePreset || "7 KG",
    checkInBaggage: saved.checkInBaggage || "",
    baggagePreset: saved.baggagePreset || "",
    cabinBaggagePreset: saved.cabinBaggagePreset || "7 KG",
    frequentFlyerAirline: saved.frequentFlyerAirline || "",
    frequentFlyerNumber: saved.frequentFlyerNumber || "",
    wheelchairAssistance: saved.wheelchairAssistance,
    dateOfBirth: saved.dateOfBirth || "",
    passportNumber: saved.passportNumber || "",
    passportIssuingCountry: saved.passportIssuingCountry || "",
    passportIssueDate: saved.passportIssueDate || "",
    passportExpiryDate: saved.passportExpiryDate || "",
  };
}

export function savedPassengerToFlightPassenger(saved: SavedPassengerRecord): FlightPassenger {
  const values = savedPassengerToWizardValues(saved);
  return {
    title: values.title!,
    firstName: values.firstName!,
    lastName: values.lastName,
    gender: values.gender!,
    paxType: values.paxType,
    seat: values.seat,
    meal: values.meal,
    handBaggage: values.handBaggage,
    checkInBaggage: values.checkInBaggage,
    frequentFlyerAirline: values.frequentFlyerAirline,
    frequentFlyerNumber: values.frequentFlyerNumber,
    wheelchairAssistance: values.wheelchairAssistance,
    dateOfBirth: values.dateOfBirth,
    passportNumber: values.passportNumber,
    passportIssuingCountry: values.passportIssuingCountry,
    passportIssueDate: values.passportIssueDate,
    passportExpiryDate: values.passportExpiryDate,
  };
}
