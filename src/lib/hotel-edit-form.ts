import { z } from "zod";
import type { HotelBooking } from "@prisma/client";
import type { BookingCustomerContact } from "@/lib/cash-customer";
import type { HotelGuest } from "@/types/booking";
import {
  hotelGuestSchema,
  optionalPanSchema,
  phoneSchema,
} from "@/lib/validators/booking";
import { buildCustomerEditFormValues } from "@/lib/flight-edit-form";

function toDateInputValue(value: Date | string | null | undefined) {
  if (!value) return "";
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export const hotelEditFormSchema = z.object({
  pnr: z.string().optional(),
  internalNotes: z.string().optional(),
  totalAmount: z.coerce.number().min(0),
  productType: z.literal("HOTEL").optional(),
  customer: z.object({
    title: z.string().optional(),
    name: z.string().min(2, "Customer name is required"),
    email: z.string().email().optional().or(z.literal("")),
    phone: phoneSchema,
    pan: optionalPanSchema,
    gstin: z.string().optional(),
    address: z.string().optional(),
    city: z.string().optional(),
    state: z.string().optional(),
    pincode: z.string().optional(),
  }),
  propertyName: z.string().min(1, "Hotel name is required"),
  propertyAddress: z.string().min(1, "Address is required"),
  city: z.string().optional(),
  propertyPhone: z.string().optional(),
  propertyEmail: z.string().email().optional().or(z.literal("")),
  checkIn: z.string().min(1, "Check-in date is required"),
  checkOut: z.string().min(1, "Check-out date is required"),
  checkInTime: z.string().optional(),
  checkOutTime: z.string().optional(),
  roomType: z.string().min(1, "Room type is required"),
  roomsCount: z.coerce.number().int().positive().optional(),
  mealPlan: z.enum(["ROOM_ONLY", "WITH_BREAKFAST", "HALF_BOARD", "FULL_BOARD"]).optional(),
  roomAmenities: z.array(z.string()).optional(),
  adultsCount: z.coerce.number().int().min(1).optional(),
  childrenCount: z.coerce.number().int().min(0).optional(),
  guests: z.array(hotelGuestSchema).optional(),
  inclusions: z.string().optional(),
  cancellationPolicy: z.string().optional(),
  includeCancellationPolicy: z.boolean().optional(),
  policies: z.string().optional(),
  agentRemarks: z.string().optional(),
});

export type HotelEditFormValues = z.infer<typeof hotelEditFormSchema>;

export function buildHotelEditFormValues(
  hotel: HotelBooking,
  customerContact: BookingCustomerContact,
  booking: { pnr?: string | null; internalNotes?: string | null; totalAmount: unknown }
): HotelEditFormValues {
  const guests = (hotel.guests as unknown as HotelGuest[]) || [];

  return {
    pnr: hotel.confirmationNo || booking.pnr || "",
    internalNotes: booking.internalNotes || "",
    totalAmount: Number(booking.totalAmount),
    productType: "HOTEL",
    customer: buildCustomerEditFormValues(customerContact),
    propertyName: hotel.propertyName || "",
    propertyAddress: hotel.propertyAddress || "",
    city: hotel.city || "",
    propertyPhone: hotel.propertyPhone || "",
    propertyEmail: hotel.propertyEmail || "",
    checkIn: toDateInputValue(hotel.checkIn),
    checkOut: toDateInputValue(hotel.checkOut),
    checkInTime: hotel.checkInTime || "02:00 PM",
    checkOutTime: hotel.checkOutTime || "12:00 PM",
    roomType: hotel.roomType || "",
    roomsCount: hotel.roomsCount || 1,
    mealPlan: hotel.mealPlan || "ROOM_ONLY",
    roomAmenities: hotel.roomAmenities || [],
    adultsCount: hotel.adultsCount || 1,
    childrenCount: hotel.childrenCount || 0,
    guests: guests.length ? guests.map((g) => ({ name: g.name || "", type: g.type || "adult" })) : [],
    inclusions: hotel.inclusions || "",
    cancellationPolicy: hotel.cancellationPolicy || "",
    includeCancellationPolicy: hotel.includeCancellationPolicy,
    policies: hotel.policies || "",
    agentRemarks: hotel.agentRemarks || "",
  };
}

export function normalizeHotelEditPayload(data: HotelEditFormValues) {
  return {
    pnr: data.pnr?.trim() || undefined,
    internalNotes: data.internalNotes,
    totalAmount: data.totalAmount,
    customer: {
      title: data.customer.title,
      name: data.customer.name.trim(),
      phone: data.customer.phone,
      email: data.customer.email?.trim() || undefined,
      pan: data.customer.pan?.trim().toUpperCase() || undefined,
      gstin: data.customer.gstin?.trim() || undefined,
      address: data.customer.address?.trim() || undefined,
      city: data.customer.city?.trim() || undefined,
      state: data.customer.state?.trim() || undefined,
      pincode: data.customer.pincode?.trim() || undefined,
    },
    propertyName: data.propertyName.trim(),
    propertyAddress: data.propertyAddress.trim(),
    city: data.city?.trim() || undefined,
    propertyPhone: data.propertyPhone?.trim() || undefined,
    propertyEmail: data.propertyEmail?.trim() || undefined,
    checkIn: data.checkIn,
    checkOut: data.checkOut,
    checkInTime: data.checkInTime?.trim() || "02:00 PM",
    checkOutTime: data.checkOutTime?.trim() || "12:00 PM",
    roomType: data.roomType.trim(),
    roomsCount: data.roomsCount || 1,
    mealPlan: data.mealPlan || "ROOM_ONLY",
    roomAmenities: data.roomAmenities || [],
    adultsCount: data.adultsCount || 1,
    childrenCount: data.childrenCount || 0,
    guests: (data.guests || []).map((g) => ({
      name: g.name?.trim() || "",
      type: g.type,
    })),
    inclusions: data.inclusions?.trim() || undefined,
    cancellationPolicy: data.cancellationPolicy?.trim() || undefined,
    includeCancellationPolicy: data.includeCancellationPolicy || false,
    policies: data.policies?.trim() || undefined,
    agentRemarks: data.agentRemarks?.trim() || undefined,
    confirmationNo: data.pnr?.trim() || undefined,
    regenerateDocuments: true,
  };
}
