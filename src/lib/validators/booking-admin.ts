import { z } from "zod";
import {
  flightPassengerSchema,
  flightSegmentSchema,
  hotelGuestSchema,
  optionalPanSchema,
  phoneSchema,
} from "@/lib/validators/booking";

export const adminCustomerUpdateSchema = z.object({
  title: z.string().optional(),
  name: z.string().min(2, "Customer name is required"),
  contactPerson: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  phone: phoneSchema,
  pan: optionalPanSchema,
  gstin: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  pincode: z.string().optional(),
});

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
  tripType: z.enum(["ONE_WAY", "ROUND_TRIP", "MULTI_CITY", "ADDON_SERVICES"]).optional(),
  addonType: z.enum(["seat", "food", "custom"]).optional(),
  addonCustomLabel: z.string().optional(),
  addonCustomValue: z.string().optional(),
  cabinClass: z.enum(["ECONOMY", "PREMIUM_ECONOMY", "BUSINESS"]).optional(),
  fareType: z.enum(["NORMAL", "CORP", "FLEXI", "UPFRONT"]).optional(),
  paymentGatewayCharge: z.coerce.number().min(0).optional(),
  secondaryPnr: z.string().optional(),
  showEticket: z.boolean().optional(),
  checkInAssistance: z.boolean().optional(),
  segments: z.array(flightSegmentSchema).min(1).optional(),
  passengers: z.array(flightPassengerSchema).min(1).optional(),
  invoiceTaxType: z.enum(["ITC", "NON_ITC"]).optional(),
  buyerGstin: z.string().optional(),
  msmeNumber: z.string().optional(),
  cancellationPolicy: z.string().optional(),
  includeCancellationPolicy: z.boolean().optional(),
  freqFlyerUpdatedToAirline: z.boolean().optional(),
  specialAssistanceUpdatedToAirline: z.boolean().optional(),
  paymentStatus: z.enum(["PAID"]).optional(),
  paymentMethod: z.string().min(1).optional(),
  customer: adminCustomerUpdateSchema.optional(),
  // Hotel stay fields (full edit)
  propertyName: z.string().min(1).optional(),
  propertyAddress: z.string().min(1).optional(),
  city: z.string().optional(),
  propertyPhone: z.string().optional(),
  propertyEmail: z.string().email().optional().or(z.literal("")),
  checkIn: z.string().min(1).optional(),
  checkOut: z.string().min(1).optional(),
  checkInTime: z.string().optional(),
  checkOutTime: z.string().optional(),
  roomType: z.string().min(1).optional(),
  roomsCount: z.coerce.number().int().positive().optional(),
  mealPlan: z.enum(["ROOM_ONLY", "WITH_BREAKFAST", "HALF_BOARD", "FULL_BOARD"]).optional(),
  roomAmenities: z.array(z.string()).optional(),
  adultsCount: z.coerce.number().int().min(1).optional(),
  childrenCount: z.coerce.number().int().min(0).optional(),
  guests: z.array(hotelGuestSchema).optional(),
  inclusions: z.string().optional(),
  policies: z.string().optional(),
  agentRemarks: z.string().optional(),
  confirmationNo: z.string().optional(),
}).superRefine((data, ctx) => {
  if (data.paymentStatus === "PAID" && !data.paymentMethod?.trim()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Payment method is required when marking as paid",
      path: ["paymentMethod"],
    });
  }
});

export const customerCreditSettingsSchema = z.object({
  creditEnabled: z.boolean(),
  creditLimit: z.coerce.number().min(0).nullable().optional(),
  paymentTermsDays: z.coerce.number().int().min(0).nullable().optional(),
});
