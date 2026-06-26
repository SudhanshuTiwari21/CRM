import { z } from "zod";
import type { FlightBooking } from "@prisma/client";
import type { FlightPassenger, FlightSegment } from "@/types/booking";
import { BAGGAGE_PRESETS, CABIN_BAGGAGE_PRESETS } from "@/lib/constants/flight";
import { buildAddonPlaceholderSegment, fromDbAddonType } from "@/lib/flight-addon";

const segmentEditSchema = z.object({
  flightNumber: z.string(),
  airline: z.string(),
  fromAirport: z.string(),
  fromCity: z.string(),
  toAirport: z.string(),
  toCity: z.string(),
  departureAt: z.string(),
  arrivalAt: z.string(),
  terminal: z.string().optional(),
  departureTerminal: z.string().optional(),
  aircraft: z.string().optional(),
  duration: z.string().optional(),
  direction: z.enum(["outbound", "return"]).optional(),
  pnr: z.string().optional(),
  layoverDuration: z.string().optional(),
  layoverAirport: z.string().optional(),
  layoverCity: z.string().optional(),
  layoverTerminal: z.string().optional(),
  layoverType: z.enum(["connection", "plane_change", "technical"]).optional(),
  layoverNote: z.string().optional(),
});

const passengerEditSchema = z.object({
  title: z.string(),
  firstName: z.string(),
  lastName: z.string(),
  gender: z.string(),
  paxType: z.enum(["adult", "child", "infant"]).optional(),
  ticketNumber: z.string().optional(),
  seat: z.string().optional(),
  meal: z.enum(["veg", "nonveg", "none"]).optional(),
  handBaggage: z.string().optional(),
  checkInBaggage: z.string().optional(),
  baggagePreset: z.string().optional(),
  cabinBaggagePreset: z.string().optional(),
  baseFare: z.coerce.number().min(0).optional(),
});

export const flightEditFormSchema = z.object({
  pnr: z.string().optional(),
  internalNotes: z.string().optional(),
  totalAmount: z.coerce.number().min(0),
  productType: z.literal("FLIGHT").optional(),
  customer: z.object({
    title: z.string().optional(),
    name: z.string().optional(),
    email: z.string().optional(),
    phone: z.string().optional(),
    gstin: z.string().optional(),
    address: z.string().optional(),
    state: z.string().optional(),
  }),
  airline: z.string().min(1, "Airline is required"),
  tripType: z.enum(["ONE_WAY", "ROUND_TRIP", "MULTI_CITY", "ADDON_SERVICES"]),
  addonType: z.enum(["seat", "food", "custom"]).optional(),
  addonCustomLabel: z.string().optional(),
  addonCustomValue: z.string().optional(),
  addonFlightNumber: z.string().optional(),
  addonTravelDate: z.string().optional(),
  cabinClass: z.enum(["ECONOMY", "PREMIUM_ECONOMY", "BUSINESS"]),
  secondaryPnr: z.string().optional(),
  showEticket: z.boolean(),
  showPassengerName: z.boolean(),
  checkInAssistance: z.boolean(),
  stopCount: z.coerce.number().min(0).max(3).optional(),
  segments: z.array(segmentEditSchema).min(1, "At least one flight segment is required"),
  passengers: z.array(passengerEditSchema).min(1, "At least one passenger is required"),
  invoiceTaxType: z.enum(["ITC", "NON_ITC"]),
  buyerGstin: z.string().optional(),
  baseFare: z.coerce.number().min(0),
  serviceCharge: z.coerce.number().min(0),
  discountAmount: z.coerce.number().min(0).optional(),
  invoiceNarration: z.string().optional(),
  msmeNumber: z.string().optional(),
});

export type FlightEditFormValues = z.infer<typeof flightEditFormSchema>;

export function toDatetimeLocalValue(value?: string | null): string {
  if (!value?.trim()) return "";
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value.trim())) return value.trim();
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
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
  customer: { gstin?: string | null; state?: string | null },
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
    customer: {
      title: "Mr",
      name: "—",
      phone: "0000000000",
      email: "",
      address: "",
      gstin: customer.gstin || "",
      state: customer.state || "",
    },
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
    secondaryPnr: flight.secondaryPnr || "",
    showEticket: flight.showEticket,
    showPassengerName: flight.showPassengerName,
    checkInAssistance: flight.checkInAssistance,
    stopCount: Math.max(0, segments.length - 1),
    segments: segments.length
      ? segments.map((s) => mapSegmentForForm(s, airline))
      : [mapSegmentForForm({ flightNumber: "", airline, fromAirport: "", fromCity: "", toAirport: "", toCity: "", departureAt: "", arrivalAt: "" }, airline)],
    passengers: passengers.length
      ? passengers.map(mapPassengerForForm)
      : [{ title: "Mr", firstName: "", lastName: "", gender: "Male", paxType: "adult" as const, cabinBaggagePreset: "7 KG" }],
    invoiceTaxType: flight.invoiceTaxType,
    buyerGstin: flight.buyerGstin || "",
    baseFare: Number(flight.baseFare || 0),
    serviceCharge: Number(flight.serviceCharge || 0),
    discountAmount: Number(flight.discountAmount || 0),
    invoiceNarration: flight.invoiceNarration || "",
    msmeNumber: flight.msmeNumber || "",
  };
}

export function normalizeFlightEditPayload(data: FlightEditFormValues) {
  const airline = data.airline.trim();
  const isAddon = data.tripType === "ADDON_SERVICES";
  const segments = isAddon
    ? [buildAddonPlaceholderSegment(airline, data.addonFlightNumber, data.addonTravelDate)]
    : data.segments.map((s) => ({
        ...s,
        airline,
        flightNumber: s.flightNumber?.trim() || "",
        fromAirport: s.fromAirport?.trim() || "",
        fromCity: s.fromCity?.trim() || "",
        toAirport: s.toAirport?.trim() || "",
        toCity: s.toCity?.trim() || "",
      }));

  const passengers = data.passengers.map(({ baggagePreset, cabinBaggagePreset, ...p }) => {
    void baggagePreset;
    void cabinBaggagePreset;
    return p;
  });

  return {
    pnr: data.pnr?.trim() || undefined,
    internalNotes: data.internalNotes,
    totalAmount: data.totalAmount,
    airline,
    tripType: data.tripType,
    addonType: data.addonType,
    addonCustomLabel: data.addonCustomLabel?.trim() || undefined,
    addonCustomValue: data.addonCustomValue?.trim() || undefined,
    cabinClass: data.cabinClass,
    secondaryPnr: data.segments?.[1]?.pnr?.trim() || data.secondaryPnr?.trim() || undefined,
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
    regenerateDocuments: true,
  };
}
