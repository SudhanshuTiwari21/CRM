import { z } from "zod";
import type { HotelBooking } from "@prisma/client";
import type { BookingCustomerContact } from "@/lib/cash-customer";
import {
  hotelGuestSchema,
  hotelRoomSchema,
  optionalPanSchema,
  phoneSchema,
} from "@/lib/validators/booking";
import { buildCustomerEditFormValues } from "@/lib/flight-edit-form";
import { normalizeHotelRooms, totalsFromHotelRooms } from "@/lib/hotel-rooms";

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
  invoiceTaxType: z.enum(["ITC", "NON_ITC"]).optional(),
  buyerGstin: z.string().optional(),
  baseFare: z.coerce.number().min(0).optional(),
  serviceCharge: z.coerce.number().min(0).optional(),
  discountAmount: z.coerce.number().min(0).optional(),
  invoiceNarration: z.string().optional(),
  msmeNumber: z.string().optional(),
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
  rooms: z.array(hotelRoomSchema).optional(),
  inclusions: z.string().optional(),
  cancellationPolicy: z.string().optional(),
  includeCancellationPolicy: z.boolean().optional(),
  policies: z.string().optional(),
  agentRemarks: z.string().optional(),
  extraServicesOpted: z.boolean().optional(),
  extraServicesNotes: z.string().optional(),
});

export type HotelEditFormValues = z.infer<typeof hotelEditFormSchema>;

export function buildHotelEditFormValues(
  hotel: HotelBooking,
  customerContact: BookingCustomerContact,
  booking: { pnr?: string | null; internalNotes?: string | null; totalAmount: unknown }
): HotelEditFormValues {
  const rooms = normalizeHotelRooms({
    rooms: hotel.rooms,
    roomsCount: hotel.roomsCount,
    adultsCount: hotel.adultsCount,
    childrenCount: hotel.childrenCount,
    guests: hotel.guests,
  });
  const totals = totalsFromHotelRooms(rooms);

  return {
    pnr: hotel.confirmationNo || booking.pnr || "",
    internalNotes: booking.internalNotes || "",
    totalAmount: Number(booking.totalAmount),
    productType: "HOTEL",
    invoiceTaxType: hotel.invoiceTaxType || "NON_ITC",
    buyerGstin: hotel.buyerGstin || customerContact.gstin || "",
    baseFare: hotel.baseFare != null ? Number(hotel.baseFare) : Number(booking.totalAmount),
    serviceCharge: hotel.serviceCharge != null ? Number(hotel.serviceCharge) : 0,
    discountAmount: hotel.discountAmount != null ? Number(hotel.discountAmount) : 0,
    invoiceNarration: hotel.invoiceNarration || "",
    msmeNumber: hotel.msmeNumber || "",
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
    roomsCount: totals.roomsCount,
    mealPlan: hotel.mealPlan || "ROOM_ONLY",
    roomAmenities: hotel.roomAmenities || [],
    adultsCount: totals.adultsCount,
    childrenCount: totals.childrenCount,
    guests: totals.guests,
    rooms,
    inclusions: hotel.inclusions || "",
    cancellationPolicy: hotel.cancellationPolicy || "",
    includeCancellationPolicy: hotel.includeCancellationPolicy,
    policies: hotel.policies || "",
    agentRemarks: hotel.agentRemarks || "",
    extraServicesOpted: hotel.extraServicesOpted || false,
    extraServicesNotes: hotel.extraServicesNotes || "",
  };
}

export function normalizeHotelEditPayload(data: HotelEditFormValues) {
  const rooms = normalizeHotelRooms({
    rooms: data.rooms,
    roomsCount: data.roomsCount,
    adultsCount: data.adultsCount,
    childrenCount: data.childrenCount,
    guests: data.guests,
  });
  const totals = totalsFromHotelRooms(rooms);

  return {
    pnr: data.pnr?.trim() || undefined,
    internalNotes: data.internalNotes,
    totalAmount: data.totalAmount,
    invoiceTaxType: data.invoiceTaxType,
    buyerGstin: data.buyerGstin?.trim() || undefined,
    baseFare: data.baseFare,
    serviceCharge: data.serviceCharge,
    discountAmount: data.discountAmount,
    invoiceNarration: data.invoiceNarration?.trim() || undefined,
    msmeNumber: data.msmeNumber?.trim() || undefined,
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
    roomsCount: totals.roomsCount,
    mealPlan: data.mealPlan || "ROOM_ONLY",
    roomAmenities: data.roomAmenities || [],
    adultsCount: totals.adultsCount,
    childrenCount: totals.childrenCount,
    guests: totals.guests,
    rooms,
    inclusions: data.inclusions?.trim() || undefined,
    cancellationPolicy: data.cancellationPolicy?.trim() || undefined,
    includeCancellationPolicy: data.includeCancellationPolicy || false,
    policies: data.policies?.trim() || undefined,
    agentRemarks: data.agentRemarks?.trim() || undefined,
    extraServicesOpted: data.extraServicesOpted || false,
    extraServicesNotes: data.extraServicesOpted
      ? data.extraServicesNotes?.trim() || undefined
      : undefined,
    confirmationNo: data.pnr?.trim() || undefined,
    regenerateDocuments: true,
  };
}
