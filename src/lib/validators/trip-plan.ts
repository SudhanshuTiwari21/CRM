import { z } from "zod";

export const tripPlanItemSchema = z.object({
  id: z.string().optional(),
  dayNumber: z.coerce.number().int().min(1).default(1),
  sortOrder: z.coerce.number().int().min(0).default(0),
  serviceType: z.enum([
    "FLIGHT",
    "HOTEL",
    "TRANSFER",
    "SIGHTSEEING",
    "VISA",
    "MEAL",
    "GUIDE",
    "INSURANCE",
    "BUS",
    "OTHER",
  ]),
  title: z.string().min(1, "Title is required"),
  description: z.string().optional().nullable(),
  supplierName: z.string().optional().nullable(),
  location: z.string().optional().nullable(),
  serviceDate: z.string().optional().nullable(),
  quantity: z.coerce.number().int().min(1).default(1),
  costPrice: z.coerce.number().min(0).default(0),
  markupType: z.enum(["FIXED", "PERCENT"]).default("FIXED"),
  markupValue: z.coerce.number().min(0).default(0),
  sellPrice: z.coerce.number().min(0).optional(),
});

export const createTripPlanSchema = z.object({
  title: z.string().min(1, "Title is required"),
  travelDate: z.string().optional().nullable(),
  returnDate: z.string().optional().nullable(),
  destinations: z.string().optional().nullable(),
  adultCount: z.coerce.number().int().min(0).optional().nullable(),
  childCount: z.coerce.number().int().min(0).optional().nullable(),
  infantCount: z.coerce.number().int().min(0).optional().nullable(),
  durationDays: z.coerce.number().int().min(1).optional().nullable(),
  currency: z.string().default("INR"),
  gstRate: z.coerce.number().min(0).max(100).optional().nullable(),
  offerPrice: z.coerce.number().min(0).optional().nullable(),
  inclusions: z.string().optional().nullable(),
  exclusions: z.string().optional().nullable(),
  terms: z.string().optional().nullable(),
  internalNotes: z.string().optional().nullable(),
  items: z.array(tripPlanItemSchema).default([]),
});

export const updateTripPlanSchema = createTripPlanSchema.partial().extend({
  status: z.enum(["DRAFT", "SENT", "ACCEPTED", "REJECTED", "SUPERSEDED"]).optional(),
});

export type CreateTripPlanInput = z.infer<typeof createTripPlanSchema>;
export type UpdateTripPlanInput = z.infer<typeof updateTripPlanSchema>;
export type TripPlanItemInput = z.infer<typeof tripPlanItemSchema>;
