import { z } from "zod";
import { isValidIndianMobile, normalizePhone } from "@/lib/phone";

const gstinRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;

export const phoneSchema = z
  .string()
  .min(10, "Phone must be at least 10 digits")
  .transform(normalizePhone)
  .refine(isValidIndianMobile, "Enter a valid 10-digit Indian mobile number");

export const flightSegmentSchema = z.object({
  flightNumber: z.string().min(1, "Flight number is required"),
  airline: z.string().min(1, "Airline is required"),
  fromAirport: z.string().min(3, "Departure airport code is required (e.g. DEL)"),
  fromCity: z.string().min(1, "Departure city is required"),
  toAirport: z.string().min(3, "Arrival airport code is required (e.g. BOM)"),
  toCity: z.string().min(1, "Arrival city is required"),
  departureAt: z.string().min(1, "Departure date and time is required"),
  arrivalAt: z.string().min(1, "Arrival date and time is required"),
  terminal: z.string().optional(),
  aircraft: z.string().optional(),
  duration: z.string().optional(),
  status: z.string().optional(),
  direction: z.enum(["outbound", "return"]).optional(),
  pnr: z.string().optional(),
  layoverDuration: z.string().optional(),
  layoverAirport: z.string().optional(),
  layoverCity: z.string().optional(),
  layoverTerminal: z.string().optional(),
  layoverType: z.enum(["connection", "plane_change", "technical"]).optional(),
  layoverNote: z.string().optional(),
  departureTerminal: z.string().optional(),
});

export const flightPassengerSchema = z.object({
  title: z.string().min(1, "Title is required"),
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().optional().or(z.literal("")),
  gender: z.string().min(1, "Gender is required"),
  paxType: z.enum(["adult", "child", "infant"]).optional(),
  ticketNumber: z.string().optional(),
  seat: z.string().optional(),
  meal: z.enum(["veg", "nonveg", "none"]).optional(),
  handBaggage: z.string().optional(),
  checkInBaggage: z.string().optional(),
  baseFare: z.coerce.number().min(0).optional(),
  frequentFlyerAirline: z.string().optional(),
  frequentFlyerNumber: z.string().optional(),
  wheelchairAssistance: z.boolean().optional(),
  dateOfBirth: z.string().optional(),
  passportNumber: z.string().optional(),
  passportIssuingCountry: z.string().optional(),
  passportIssueDate: z.string().optional(),
  passportExpiryDate: z.string().optional(),
  baggagePreset: z.string().optional(),
  cabinBaggagePreset: z.string().optional(),
});

export const hotelGuestSchema = z.object({
  name: z.string().min(1),
  type: z.enum(["adult", "child"]),
});

export const busPassengerSchema = z.object({
  name: z.string().min(1),
  seat: z.string().min(1),
  gender: z.string().optional(),
});

const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;

export const optionalPanSchema = z
  .string()
  .optional()
  .or(z.literal(""))
  .refine((v) => !v || panRegex.test(v.toUpperCase()), "Invalid PAN format (e.g. ABCDE1234F)");

export const customerSchema = z.object({
  name: z.string().min(2),
  email: z.string().email().optional().or(z.literal("")),
  phone: phoneSchema,
  pan: optionalPanSchema,
  gstin: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  pincode: z.string().optional(),
});

function validateOptionalPan(pan: string | undefined, ctx: z.RefinementCtx, path: string[]) {
  if (pan?.trim() && !panRegex.test(pan.trim().toUpperCase())) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Invalid PAN format (e.g. ABCDE1234F)",
      path,
    });
  }
}

function refineOfflineBilling(
  data: {
    billingType: "CASH" | "LEDGER";
    ledgerMode?: "EXISTING" | "NEW";
    customerId?: string;
    customer?: {
      name?: string;
      phone?: string;
      email?: string;
      pan?: string;
      gstin?: string;
      address?: string;
      city?: string;
      state?: string;
      pincode?: string;
    };
    paymentMethod?: string;
  },
  ctx: z.RefinementCtx
) {
  if (data.billingType === "CASH") {
    if (!data.customer?.name?.trim() || data.customer.name.trim().length < 2) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Customer name is required", path: ["customer", "name"] });
    }
    if (!data.customer?.phone || !isValidIndianMobile(normalizePhone(data.customer.phone))) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Enter a valid 10-digit mobile number",
        path: ["customer", "phone"],
      });
    }
    validateOptionalPan(data.customer?.pan, ctx, ["customer", "pan"]);
    if (data.paymentMethod === "CREDIT") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Credit payment is only available for ledger bills",
        path: ["paymentMethod"],
      });
    }
    return;
  }
  if (!data.ledgerMode) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Select ledger option", path: ["ledgerMode"] });
    return;
  }
  if (data.ledgerMode === "EXISTING") {
    if (!data.customerId) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Select a customer", path: ["customerId"] });
      return;
    }
    if (!data.customer?.name?.trim() || data.customer.name.trim().length < 2) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Customer name is required", path: ["customer", "name"] });
    }
    if (!data.customer?.phone || !isValidIndianMobile(normalizePhone(data.customer.phone))) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Enter a valid 10-digit mobile number",
        path: ["customer", "phone"],
      });
    }
    validateOptionalPan(data.customer?.pan, ctx, ["customer", "pan"]);
    return;
  }
  if (!data.customer?.name?.trim() || data.customer.name.trim().length < 2) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Customer name is required", path: ["customer", "name"] });
  }
  if (!data.customer?.phone || !isValidIndianMobile(normalizePhone(data.customer.phone))) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Enter a valid 10-digit mobile number",
      path: ["customer", "phone"],
    });
  }
  validateOptionalPan(data.customer?.pan, ctx, ["customer", "pan"]);
}

export { refineOfflineBilling };

type InternationalPassengerInput = {
  title?: string;
  firstName?: string;
  dateOfBirth?: string;
  passportNumber?: string;
  passportIssuingCountry?: string;
  passportIssueDate?: string;
  passportExpiryDate?: string;
};

export function refineInternationalPassengers(
  data: { showEticket?: boolean; passengers?: InternationalPassengerInput[] },
  ctx: z.RefinementCtx
) {
  if (!data.showEticket || !data.passengers?.length) return;

  data.passengers.forEach((p, i) => {
    if (!p.title?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Title is required for international bookings",
        path: ["passengers", i, "title"],
      });
    }
    if (!p.firstName?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Traveler name is required for international bookings",
        path: ["passengers", i, "firstName"],
      });
    }
    if (!p.dateOfBirth?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Date of birth is required for international bookings",
        path: ["passengers", i, "dateOfBirth"],
      });
    }
    if (!p.passportNumber?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Passport number is required for international bookings",
        path: ["passengers", i, "passportNumber"],
      });
    }
    if (!p.passportIssuingCountry?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Passport issuing country is required for international bookings",
        path: ["passengers", i, "passportIssuingCountry"],
      });
    }
    if (!p.passportIssueDate?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Passport issue date is required for international bookings",
        path: ["passengers", i, "passportIssueDate"],
      });
    }
    if (!p.passportExpiryDate?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Passport expiry date is required for international bookings",
        path: ["passengers", i, "passportExpiryDate"],
      });
    }
  });
}

export const offlineFlightBookingSchema = z
  .object({
  productType: z.literal("FLIGHT"),
  channel: z.literal("OFFLINE"),
  billingType: z.enum(["CASH", "LEDGER"]),
  ledgerMode: z.enum(["EXISTING", "NEW"]).optional(),
  customerId: z.string().optional(),
  customer: customerSchema.optional(),
  totalAmount: z.coerce.number().positive(),
  airline: z.string().min(1),
  tripType: z.enum(["ONE_WAY", "ROUND_TRIP", "MULTI_CITY", "ADDON_SERVICES"]).optional(),
  addonType: z.enum(["seat", "food", "custom"]).optional(),
  addonCustomLabel: z.string().optional(),
  addonCustomValue: z.string().optional(),
  addonFlightNumber: z.string().optional(),
  addonTravelDate: z.string().optional(),
  cabinClass: z.enum(["ECONOMY", "PREMIUM_ECONOMY", "BUSINESS"]).optional(),
  fareType: z.enum(["NORMAL", "CORP", "FLEXI", "UPFRONT"]).optional(),
  paymentGatewayCharge: z.coerce.number().min(0).optional(),
  secondaryPnr: z.string().optional(),
  showEticket: z.boolean().optional(),
  showPassengerName: z.boolean().optional(),
  checkInAssistance: z.boolean().optional(),
  segments: z.array(flightSegmentSchema).min(1),
  passengers: z.array(flightPassengerSchema).min(1),
  paymentMethod: z.enum(["UPI", "Cash", "Card", "Bank Transfer", "CREDIT"]).optional(),
  internalNotes: z.string().optional(),
  invoiceTaxType: z.enum(["ITC", "NON_ITC"]),
  buyerGstin: z
    .string()
    .optional()
    .or(z.literal(""))
    .refine((v) => !v || gstinRegex.test(v.toUpperCase()), "Invalid GSTIN format"),
  baseFare: z.coerce.number().min(0),
  serviceCharge: z.coerce.number().min(0),
  discountAmount: z.coerce.number().min(0).optional(),
  invoiceNarration: z.string().optional(),
  msmeNumber: z.string().optional(),
  cancellationPolicy: z.string().optional(),
  includeCancellationPolicy: z.boolean().optional(),
  })
  .superRefine(refineOfflineBilling)
  .superRefine(refineInternationalPassengers);

export const offlineHotelBookingSchema = z
  .object({
  productType: z.literal("HOTEL"),
  channel: z.literal("OFFLINE"),
  billingType: z.enum(["CASH", "LEDGER"]),
  ledgerMode: z.enum(["EXISTING", "NEW"]).optional(),
  customerId: z.string().optional(),
  customer: customerSchema.optional(),
  totalAmount: z.coerce.number().positive(),
  propertyName: z.string().min(1),
  propertyAddress: z.string().min(1),
  city: z.string().optional(),
  propertyPhone: z.string().optional(),
  propertyEmail: z.string().email().optional().or(z.literal("")),
  checkIn: z.string().min(1),
  checkOut: z.string().min(1),
  checkInTime: z.string().optional(),
  checkOutTime: z.string().optional(),
  roomType: z.string().min(1),
  roomsCount: z.coerce.number().int().positive().optional(),
  mealPlan: z.enum(["ROOM_ONLY", "WITH_BREAKFAST", "HALF_BOARD", "FULL_BOARD"]).optional(),
  roomAmenities: z.array(z.string()).optional(),
  guests: z.array(hotelGuestSchema).min(1),
  inclusions: z.string().optional(),
  cancellationPolicy: z.string().optional(),
  includeCancellationPolicy: z.boolean().optional(),
  policies: z.string().optional(),
  agentRemarks: z.string().optional(),
  paymentMethod: z.enum(["UPI", "Cash", "Card", "Bank Transfer", "CREDIT"]).optional(),
  internalNotes: z.string().optional(),
  })
  .superRefine(refineOfflineBilling);

export const offlineBusBookingSchema = z
  .object({
  productType: z.literal("BUS"),
  channel: z.literal("OFFLINE"),
  billingType: z.enum(["CASH", "LEDGER"]),
  ledgerMode: z.enum(["EXISTING", "NEW"]).optional(),
  customerId: z.string().optional(),
  customer: customerSchema.optional(),
  totalAmount: z.coerce.number().positive(),
  operator: z.string().min(1),
  route: z.string().min(1),
  boardingPoint: z.string().min(1),
  droppingPoint: z.string().min(1),
  departureAt: z.string().min(1),
  arrivalAt: z.string().min(1),
  seats: z.array(z.object({ seatNumber: z.string(), type: z.string().optional() })).min(1),
  passengers: z.array(busPassengerSchema).min(1),
  paymentMethod: z.enum(["UPI", "Cash", "Card", "Bank Transfer", "CREDIT"]).optional(),
  internalNotes: z.string().optional(),
  })
  .superRefine(refineOfflineBilling);

export const offlineBookingSchema = z.union([
  offlineFlightBookingSchema,
  offlineHotelBookingSchema,
  offlineBusBookingSchema,
]);

export const confirmPnrSchema = z.object({
  pnr: z.string().min(3, "PNR is required"),
  secondaryPnr: z.string().optional(),
  supplierRef: z.string().optional(),
  ticketNumbers: z.array(z.string().min(1, "E-ticket number is required")).optional(),
});

export const sendItinerarySchema = z.object({
  pnr: z.string().min(3, "PNR is required"),
  secondaryPnr: z.string().optional(),
  ticketNumbers: z.array(z.string().min(1, "E-ticket number is required")).optional(),
});

export const webhookLiveBookingSchema = z.object({
  productType: z.enum(["FLIGHT", "HOTEL", "BUS"]),
  customer: customerSchema,
  totalAmount: z.coerce.number().positive(),
  paymentMethod: z.string(),
  gatewayRef: z.string().optional(),
  flight: z
    .object({
      airline: z.string(),
      segments: z.array(flightSegmentSchema),
      passengers: z.array(flightPassengerSchema),
    })
    .optional(),
  hotel: z
    .object({
      propertyName: z.string(),
      propertyAddress: z.string(),
      checkIn: z.string(),
      checkOut: z.string(),
      roomType: z.string(),
      guests: z.array(hotelGuestSchema),
    })
    .optional(),
  bus: z
    .object({
      operator: z.string(),
      route: z.string(),
      boardingPoint: z.string(),
      droppingPoint: z.string(),
      departureAt: z.string(),
      arrivalAt: z.string(),
      seats: z.array(z.object({ seatNumber: z.string() })),
      passengers: z.array(busPassengerSchema),
    })
    .optional(),
});
