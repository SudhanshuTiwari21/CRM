import { z } from "zod";

const savedPassengerFieldsSchema = {
  title: z.string().min(1).default("Mr"),
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().optional().nullable(),
  gender: z.string().min(1).default("Male"),
  paxType: z.enum(["adult", "child", "infant"]).default("adult"),
  seat: z.string().optional().nullable(),
  meal: z.enum(["veg", "nonveg", "none"]).optional().nullable(),
  handBaggage: z.string().optional().nullable(),
  checkInBaggage: z.string().optional().nullable(),
  baggagePreset: z.string().optional().nullable(),
  cabinBaggagePreset: z.string().optional().nullable(),
  frequentFlyerAirline: z.string().optional().nullable(),
  frequentFlyerNumber: z.string().optional().nullable(),
  wheelchairAssistance: z.boolean().optional(),
  dateOfBirth: z.string().optional().nullable(),
  passportNumber: z.string().optional().nullable(),
  passportIssuingCountry: z.string().optional().nullable(),
  passportIssueDate: z.string().optional().nullable(),
  passportExpiryDate: z.string().optional().nullable(),
};

export const upsertSavedPassengerSchema = z.object(savedPassengerFieldsSchema);

export const updateSavedPassengerSchema = z.object(savedPassengerFieldsSchema).partial();

export type UpsertSavedPassengerInput = z.infer<typeof upsertSavedPassengerSchema>;
