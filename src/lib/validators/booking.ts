import { z } from "zod";

export const flightSegmentSchema = z.object({
  flightNumber: z.string().min(1),
  airline: z.string().min(1),
  fromAirport: z.string().min(3),
  fromCity: z.string().min(1),
  toAirport: z.string().min(3),
  toCity: z.string().min(1),
  departureAt: z.string().min(1),
  arrivalAt: z.string().min(1),
  terminal: z.string().optional(),
  aircraft: z.string().optional(),
  duration: z.string().optional(),
  status: z.string().optional(),
});

export const flightPassengerSchema = z.object({
  title: z.string().min(1),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  gender: z.string().min(1),
  ticketNumber: z.string().optional(),
  seat: z.string().optional(),
  handBaggage: z.string().optional(),
  checkInBaggage: z.string().optional(),
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

export const customerSchema = z.object({
  name: z.string().min(2),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().min(10),
  gstin: z.string().optional(),
  address: z.string().optional(),
});

export const offlineFlightBookingSchema = z.object({
  productType: z.literal("FLIGHT"),
  channel: z.literal("OFFLINE"),
  customer: customerSchema,
  totalAmount: z.coerce.number().positive(),
  airline: z.string().min(1),
  segments: z.array(flightSegmentSchema).min(1),
  passengers: z.array(flightPassengerSchema).min(1),
  paymentMethod: z.string().optional(),
  internalNotes: z.string().optional(),
});

export const offlineHotelBookingSchema = z.object({
  productType: z.literal("HOTEL"),
  channel: z.literal("OFFLINE"),
  customer: customerSchema,
  totalAmount: z.coerce.number().positive(),
  propertyName: z.string().min(1),
  propertyAddress: z.string().min(1),
  checkIn: z.string().min(1),
  checkOut: z.string().min(1),
  roomType: z.string().min(1),
  guests: z.array(hotelGuestSchema).min(1),
  policies: z.string().optional(),
  agentRemarks: z.string().optional(),
  paymentMethod: z.string().optional(),
  internalNotes: z.string().optional(),
});

export const offlineBusBookingSchema = z.object({
  productType: z.literal("BUS"),
  channel: z.literal("OFFLINE"),
  customer: customerSchema,
  totalAmount: z.coerce.number().positive(),
  operator: z.string().min(1),
  route: z.string().min(1),
  boardingPoint: z.string().min(1),
  droppingPoint: z.string().min(1),
  departureAt: z.string().min(1),
  arrivalAt: z.string().min(1),
  seats: z.array(z.object({ seatNumber: z.string(), type: z.string().optional() })).min(1),
  passengers: z.array(busPassengerSchema).min(1),
  paymentMethod: z.string().optional(),
  internalNotes: z.string().optional(),
});

export const offlineBookingSchema = z.discriminatedUnion("productType", [
  offlineFlightBookingSchema,
  offlineHotelBookingSchema,
  offlineBusBookingSchema,
]);

export const confirmPnrSchema = z.object({
  pnr: z.string().min(3, "PNR is required"),
  supplierRef: z.string().optional(),
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
