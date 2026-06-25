import { z } from "zod";
import { flightPassengerSchema, flightSegmentSchema } from "@/lib/validators/booking";

export const adminBookingUpdateSchema = z.object({
  pnr: z.string().optional(),
  internalNotes: z.string().optional(),
  totalAmount: z.coerce.number().positive().optional(),
  invoiceNarration: z.string().optional(),
  showPassengerName: z.boolean().optional(),
  baseFare: z.coerce.number().min(0).optional(),
  serviceCharge: z.coerce.number().min(0).optional(),
  discountAmount: z.coerce.number().min(0).optional(),
  regenerateDocuments: z.boolean().optional(),
  airline: z.string().min(1).optional(),
  tripType: z.enum(["ONE_WAY", "ROUND_TRIP", "MULTI_CITY"]).optional(),
  cabinClass: z.enum(["ECONOMY", "PREMIUM_ECONOMY", "BUSINESS"]).optional(),
  secondaryPnr: z.string().optional(),
  showEticket: z.boolean().optional(),
  checkInAssistance: z.boolean().optional(),
  segments: z.array(flightSegmentSchema).min(1).optional(),
  passengers: z.array(flightPassengerSchema).min(1).optional(),
  invoiceTaxType: z.enum(["ITC", "NON_ITC"]).optional(),
  buyerGstin: z.string().optional(),
  msmeNumber: z.string().optional(),
});

export const customerCreditSettingsSchema = z.object({
  creditEnabled: z.boolean(),
  creditLimit: z.coerce.number().min(0).nullable().optional(),
  paymentTermsDays: z.coerce.number().int().min(0).nullable().optional(),
});
