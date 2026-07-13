import { z } from "zod";
import type { FlightBooking } from "@prisma/client";
import type { BookingCustomerContact } from "@/lib/cash-customer";
import type { FlightPassenger, FlightSegment } from "@/types/booking";
import { BAGGAGE_PRESETS, CABIN_BAGGAGE_PRESETS } from "@/lib/constants/flight";
import { buildAddonPlaceholderSegment, fromDbAddonType } from "@/lib/flight-addon";
import { getReturnLegStartIndex } from "@/lib/flight-layover";
import { normalizeFlightSegments, toDatetimeLocalValue } from "@/lib/flight-datetime";
import { splitCustomerName } from "@/lib/utils";
import {
  flightPassengerSchema,
  flightSegmentSchema,
  optionalPanSchema,
  phoneSchema,
  refineInternationalPassengers,
} from "@/lib/validators/booking";

export { toDatetimeLocalValue };

const segmentEditSchema = flightSegmentSchema;
const passengerEditSchema = flightPassengerSchema;

export const flightEditFormSchema = z.object({
  pnr: z.string().optional(),
  internalNotes: z.string().optional(),
  totalAmount: z.coerce.number().min(0),
  productType: z.literal("FLIGHT").optional(),
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
  airline: z.string().min(1, "Airline is required"),
  tripType: z.enum(["ONE_WAY", "ROUND_TRIP", "MULTI_CITY", "ADDON_SERVICES"]),
  addonType: z.enum(["seat", "food", "custom"]).optional(),
  addonCustomLabel: z.string().optional(),
  addonCustomValue: z.string().optional(),
  addonFlightNumber: z.string().optional(),
  addonTravelDate: z.string().optional(),
  cabinClass: z.enum(["ECONOMY", "PREMIUM_ECONOMY", "BUSINESS"]),
  fareType: z.enum(["NORMAL", "CORP", "FLEXI", "UPFRONT"]).optional(),
  paymentGatewayCharge: z.coerce.number().min(0).optional(),
  flightInvoiceSubtotal: z.coerce.number().min(0).optional(),
  secondaryPnr: z.string().optional(),
  showEticket: z.boolean(),
  showPassengerName: z.boolean(),
  checkInAssistance: z.boolean(),
  stopCount: z.coerce.number().min(0).max(3).optional(),
  returnStopCount: z.coerce.number().min(0).max(3).optional(),
  segments: z.array(segmentEditSchema).min(1, "At least one flight segment is required"),
  passengers: z.array(passengerEditSchema).min(1, "At least one passenger is required"),
  invoiceTaxType: z.enum(["ITC", "NON_ITC"]),
  buyerGstin: z.string().optional(),
  baseFare: z.coerce.number().min(0),
  serviceCharge: z.coerce.number().min(0),
  discountAmount: z.coerce.number().min(0).optional(),
  invoiceNarration: z.string().optional(),
  msmeNumber: z.string().optional(),
  cancellationPolicy: z.string().optional(),
  includeCancellationPolicy: z.boolean().optional(),
  freqFlyerUpdatedToAirline: z.boolean().optional(),
  specialAssistanceUpdatedToAirline: z.boolean().optional(),
})
  .superRefine(refineInternationalPassengers);

export type FlightEditFormValues = z.infer<typeof flightEditFormSchema>;

export function buildCustomerEditFormValues(contact: BookingCustomerContact) {
  const { title, name } = splitCustomerName(contact.name);
  return {
    title,
    name,
    phone: contact.phone,
    email: contact.email || "",
    pan: contact.pan || "",
    gstin: contact.gstin || "",
    address: contact.address || "",
    city: contact.city || "",
    state: contact.state || "",
    pincode: contact.pincode || "",
  };
}

function inferPreset(value: string | undefined, presets: readonly string[]): string {
  if (!value?.trim()) return presets.includes("7 KG") ? "7 KG" : "";
  return presets.includes(value) ? value : "Custom";
}

function mapPassengerForForm(p: FlightPassenger) {
  return {
    ...p,
    baseFare: p.baseFare != null ? Number(p.baseFare) : undefined,
    baggagePreset: inferPreset(p.checkInBaggage, BAGGAGE_PRESETS),
    cabinBaggagePreset: inferPreset(p.handBaggage, CABIN_BAGGAGE_PRESETS),
  };
}

function mapSegmentForForm(seg: FlightSegment, airline: string) {
  return {
    ...seg,
    airline: airline || seg.airline,
    flightNumber: seg.flightNumber || "",
    fromAirport: seg.fromAirport || "",
    fromCity: seg.fromCity || "",
    toAirport: seg.toAirport || "",
    toCity: seg.toCity || "",
    departureAt: toDatetimeLocalValue(seg.departureAt),
    arrivalAt: toDatetimeLocalValue(seg.arrivalAt),
    layoverType: seg.layoverType || ("connection" as const),
  };
}

export function buildFlightEditFormValues(
  flight: FlightBooking,
  customerContact: BookingCustomerContact,
  booking: { pnr?: string | null; internalNotes?: string | null; totalAmount: unknown }
): FlightEditFormValues {
  const segments = (flight.segments as unknown as FlightSegment[]) || [];
  const passengers = (flight.passengers as unknown as FlightPassenger[]) || [];
  const airline = flight.airline || "IndiGo";

  return {
    pnr: booking.pnr || "",
    internalNotes: booking.internalNotes || "",
    totalAmount: Number(booking.totalAmount),
    productType: "FLIGHT",
    customer: buildCustomerEditFormValues(customerContact),
    airline,
    tripType: flight.tripType,
    addonType: fromDbAddonType(flight.addonType),
    addonCustomLabel: flight.addonCustomLabel || "",
    addonCustomValue: flight.addonCustomValue || "",
    addonFlightNumber:
      segments[0]?.flightNumber && segments[0].flightNumber !== "ADDON"
        ? segments[0].flightNumber
        : "",
    addonTravelDate: segments[0]?.departureAt ? toDatetimeLocalValue(segments[0].departureAt) : "",
    cabinClass: flight.cabinClass,
    fareType: flight.fareType || "NORMAL",
    paymentGatewayCharge: Number(flight.paymentGatewayCharge || 0),
    secondaryPnr: flight.secondaryPnr || "",
    showEticket: flight.showEticket,
    showPassengerName: flight.showPassengerName,
    checkInAssistance: flight.checkInAssistance,
    stopCount:
      flight.tripType === "ROUND_TRIP"
        ? Math.max(0, getReturnLegStartIndex(segments) - 1)
        : Math.max(0, segments.length - 1),
    returnStopCount:
      flight.tripType === "ROUND_TRIP"
        ? Math.max(0, segments.length - getReturnLegStartIndex(segments) - 1)
        : 0,
    segments: segments.length
      ? segments.map((s, i) => {
          const mapped = mapSegmentForForm(s, airline);
          if (flight.tripType === "ROUND_TRIP") {
            const splitAt = getReturnLegStartIndex(segments);
            mapped.direction = i < splitAt ? "outbound" : "return";
          }
          return mapped;
        })
      : [mapSegmentForForm({ flightNumber: "", airline, fromAirport: "", fromCity: "", toAirport: "", toCity: "", departureAt: "", arrivalAt: "" }, airline)],
    passengers: passengers.length
      ? passengers.map(mapPassengerForForm)
      : [{
          title: "Mr",
          firstName: "",
          lastName: "",
          gender: "Male",
          paxType: "adult" as const,
          cabinBaggagePreset: "7 KG",
          dateOfBirth: "",
          passportNumber: "",
          passportIssuingCountry: "",
          passportIssueDate: "",
          passportExpiryDate: "",
        }],
    invoiceTaxType: flight.invoiceTaxType,
    buyerGstin: flight.buyerGstin || "",
    baseFare: Number(flight.baseFare || 0),
    serviceCharge: Number(flight.serviceCharge || 0),
    discountAmount: Number(flight.discountAmount || 0),
    invoiceNarration: flight.invoiceNarration || "",
    msmeNumber: flight.msmeNumber || "",
    cancellationPolicy: flight.cancellationPolicy || "",
    includeCancellationPolicy: flight.includeCancellationPolicy,
    freqFlyerUpdatedToAirline: flight.freqFlyerUpdatedToAirline,
    specialAssistanceUpdatedToAirline: flight.specialAssistanceUpdatedToAirline,
  };
}

export function normalizeFlightEditPayload(data: FlightEditFormValues) {
  const airline = data.airline.trim();
  const isAddon = data.tripType === "ADDON_SERVICES";
  const segments = isAddon
    ? [buildAddonPlaceholderSegment(airline, data.addonFlightNumber, data.addonTravelDate)]
    : normalizeFlightSegments(
        data.segments.map((s) => ({
          ...s,
          airline,
          flightNumber: s.flightNumber?.trim() || "",
          fromAirport: s.fromAirport?.trim() || "",
          fromCity: s.fromCity?.trim() || "",
          toAirport: s.toAirport?.trim() || "",
          toCity: s.toCity?.trim() || "",
        }))
      );

  const passengers = data.passengers.map(({ baggagePreset, cabinBaggagePreset, ...p }) => {
    void baggagePreset;
    void cabinBaggagePreset;
    return p;
  });

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
    airline,
    tripType: data.tripType,
    addonType: data.addonType,
    addonCustomLabel: data.addonCustomLabel?.trim() || undefined,
    addonCustomValue: data.addonCustomValue?.trim() || undefined,
    cabinClass: data.cabinClass,
    fareType: data.fareType || "NORMAL",
    paymentGatewayCharge: data.paymentGatewayCharge ?? 0,
    secondaryPnr:
      data.tripType === "ROUND_TRIP"
        ? data.segments?.[getReturnLegStartIndex(data.segments)]?.pnr?.trim() ||
          data.secondaryPnr?.trim() ||
          undefined
        : data.segments?.[1]?.pnr?.trim() || data.secondaryPnr?.trim() || undefined,
    showEticket: isAddon ? false : data.showEticket,
    showPassengerName: data.showPassengerName,
    checkInAssistance: isAddon ? false : data.checkInAssistance,
    segments,
    passengers,
    invoiceTaxType: data.invoiceTaxType,
    buyerGstin: data.buyerGstin?.trim() || undefined,
    baseFare: data.baseFare,
    serviceCharge: data.serviceCharge,
    discountAmount: data.discountAmount ?? 0,
    invoiceNarration: data.invoiceNarration?.trim() || undefined,
    msmeNumber: data.msmeNumber?.trim() || undefined,
    cancellationPolicy: data.cancellationPolicy?.trim() || undefined,
    includeCancellationPolicy: data.includeCancellationPolicy || false,
    freqFlyerUpdatedToAirline: data.freqFlyerUpdatedToAirline,
    specialAssistanceUpdatedToAirline: data.specialAssistanceUpdatedToAirline,
    regenerateDocuments: true,
  };
}
