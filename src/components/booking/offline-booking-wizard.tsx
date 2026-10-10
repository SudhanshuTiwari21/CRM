"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, useFieldArray, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { HotelBookingFields } from "@/components/booking/hotel-booking-fields";
import { FlightBookingFields } from "@/components/booking/flight-booking-fields";
import { FlightInvoiceFields } from "@/components/booking/flight-invoice-fields";
import { HotelInvoiceFields } from "@/components/booking/hotel-invoice-fields";
import { TicketUploadPanel } from "@/components/booking/ticket-upload-panel";
import { parseApiResponse } from "@/lib/parse-api-response";
import { formatCustomerName } from "@/lib/utils";
import { getFirstFormErrorMessage } from "@/lib/form-errors";
import { buildAddonPlaceholderSegment, validateAddonBooking } from "@/lib/flight-addon";
import { getReturnLegStartIndex } from "@/lib/flight-layover";
import { CustomerBillingSection } from "@/components/booking/customer-billing-section";
import { FlightDateTimeInput } from "@/components/booking/flight-datetime-input";
import {
  flightPassengerSchema,
  flightSegmentSchema,
  refineInternationalPassengers,
  refineOfflineBilling,
} from "@/lib/validators/booking";
import { normalizePhone } from "@/lib/phone";
import type { ParsedTicketResult } from "@/lib/services/ticket-parse.service";
import { normalizeHotelRooms, totalsFromHotelRooms } from "@/lib/hotel-rooms";

const baseCustomer = {
  title: "Mr",
  name: "",
  contactPerson: "",
  email: "",
  phone: "",
  pan: "",
  gstin: "",
  address: "",
  city: "",
  state: "",
  pincode: "",
};

const wizardSchema = z
  .object({
  productType: z.enum(["FLIGHT", "HOTEL", "BUS"]),
  billingType: z.enum(["CASH", "LEDGER"]),
  cashBillTo: z.enum(["INDIVIDUAL", "COMPANY"]).optional(),
  ledgerBillTo: z.enum(["INDIVIDUAL", "COMPANY"]).optional(),
  ledgerMode: z.enum(["EXISTING", "NEW"]).optional(),
  customerId: z.string().optional(),
  customer: z.object({
    title: z.string().optional(),
    name: z.string(),
    contactPerson: z.string().optional(),
    email: z.string().email("Invalid email").optional().or(z.literal("")),
    phone: z.string(),
    pan: z.string().optional(),
    gstin: z.string().optional(),
    address: z.string().optional(),
    city: z.string().optional(),
    state: z.string().optional(),
    pincode: z.string().optional(),
  }),
  totalAmount: z.coerce.number().min(0),
  internalNotes: z.string().optional(),
  invoiceTaxType: z.enum(["ITC", "NON_ITC"]).optional(),
  buyerGstin: z.string().optional(),
  baseFare: z.coerce.number().optional(),
  serviceCharge: z.coerce.number().optional(),
  discountAmount: z.coerce.number().optional(),
  invoiceNarration: z.string().optional(),
  msmeNumber: z.string().optional(),
  tripType: z.enum(["ONE_WAY", "ROUND_TRIP", "MULTI_CITY", "ADDON_SERVICES"]).optional(),
  addonType: z.enum(["seat", "food", "custom"]).optional(),
  addonCustomLabel: z.string().optional(),
  addonCustomValue: z.string().optional(),
  addonFlightNumber: z.string().optional(),
  addonTravelDate: z.string().optional(),
  cabinClass: z.enum(["ECONOMY", "PREMIUM_ECONOMY", "BUSINESS"]).optional(),
  fareType: z.enum(["NORMAL", "CORP", "FLEXI", "UPFRONT"]).optional(),
  paymentGatewayCharge: z.coerce.number().min(0).optional(),
  flightInvoiceSubtotal: z.coerce.number().min(0).optional(),
  secondaryPnr: z.string().optional(),
  showEticket: z.boolean().optional(),
  showPassengerName: z.boolean().optional(),
  checkInAssistance: z.boolean().optional(),
  stopCount: z.coerce.number().min(0).max(3).optional(),
  returnStopCount: z.coerce.number().min(0).max(3).optional(),
  // Flight
  airline: z.string().optional(),
  segments: z.array(flightSegmentSchema).optional(),
  passengers: z.array(flightPassengerSchema).optional(),
  // Hotel
  propertyName: z.string().optional(),
  propertyAddress: z.string().optional(),
  city: z.string().optional(),
  propertyPhone: z.string().optional(),
  propertyEmail: z.string().optional(),
  checkIn: z.string().optional(),
  checkOut: z.string().optional(),
  checkInTime: z.string().optional(),
  checkOutTime: z.string().optional(),
  roomType: z.string().optional(),
  roomsCount: z.coerce.number().optional(),
  mealPlan: z.string().optional(),
  roomAmenities: z.array(z.string()).optional(),
  adultsCount: z.coerce.number().min(1).optional(),
  childrenCount: z.coerce.number().min(0).optional(),
  inclusions: z.string().optional(),
  cancellationPolicy: z.string().optional(),
  includeCancellationPolicy: z.boolean().optional(),
  guests: z
    .array(
      z.object({
        name: z.string(),
        type: z.enum(["adult", "child"]),
        roomNumber: z.coerce.number().optional(),
      })
    )
    .optional(),
  rooms: z
    .array(
      z.object({
        roomNumber: z.coerce.number(),
        adultsCount: z.coerce.number().min(1),
        childrenCount: z.coerce.number().min(0),
        guests: z.array(
          z.object({
            name: z.string(),
            type: z.enum(["adult", "child"]),
            roomNumber: z.coerce.number().optional(),
          })
        ),
      })
    )
    .optional(),
  // Bus
  operator: z.string().optional(),
  route: z.string().optional(),
  boardingPoint: z.string().optional(),
  droppingPoint: z.string().optional(),
  departureAt: z.string().optional(),
  arrivalAt: z.string().optional(),
  busPassengers: z.array(z.object({ name: z.string(), seat: z.string(), gender: z.string().optional() })).optional(),
  seats: z.array(z.object({ seatNumber: z.string() })).optional(),
  })
  .superRefine(refineOfflineBilling)
  .superRefine((data, ctx) => {
    if (data.productType !== "FLIGHT") return;

    const segResult = z.array(flightSegmentSchema).min(1, "At least one flight segment is required").safeParse(data.segments);
    if (!segResult.success) {
      for (const issue of segResult.error.issues) {
        ctx.addIssue({ ...issue, path: ["segments", ...issue.path] });
      }
    }

    const paxResult = z.array(flightPassengerSchema).min(1, "At least one passenger is required").safeParse(data.passengers);
    if (!paxResult.success) {
      for (const issue of paxResult.error.issues) {
        ctx.addIssue({ ...issue, path: ["passengers", ...issue.path] });
      }
    }

    refineInternationalPassengers(data, ctx);
  });

type WizardForm = z.infer<typeof wizardSchema>;

export type { WizardForm };

const baseZodResolver = zodResolver(wizardSchema);
const wizardResolver: Resolver<WizardForm> = (values, context, options) => {
  const cleaned = { ...values };
  if (cleaned.productType !== "FLIGHT") {
    cleaned.segments = undefined;
    cleaned.passengers = undefined;
  }
  return baseZodResolver(cleaned, context, options);
};

export function OfflineBookingWizard() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [productType, setProductType] = useState<"FLIGHT" | "HOTEL" | "BUS">("FLIGHT");

  const form = useForm<WizardForm>({
    resolver: wizardResolver,
    defaultValues: {
      productType: "FLIGHT",
      billingType: "LEDGER",
      cashBillTo: "INDIVIDUAL",
      ledgerBillTo: "INDIVIDUAL",
      ledgerMode: "EXISTING",
      customerId: undefined,
      customer: baseCustomer,
      totalAmount: 0,
      invoiceTaxType: "NON_ITC",
      buyerGstin: "",
      baseFare: 0,
      serviceCharge: 0,
      discountAmount: 0,
      invoiceNarration: "",
      msmeNumber: "",
      tripType: "ONE_WAY",
      addonType: "seat",
      addonCustomLabel: "",
      addonCustomValue: "",
      addonFlightNumber: "",
      addonTravelDate: "",
      cabinClass: "ECONOMY",
      fareType: "NORMAL",
      paymentGatewayCharge: 0,
      flightInvoiceSubtotal: 0,
      stopCount: 0,
      returnStopCount: 0,
      showEticket: false,
      showPassengerName: true,
      checkInAssistance: false,
      airline: "IndiGo",
      segments: [{
        flightNumber: "", airline: "IndiGo", fromAirport: "", fromCity: "",
        toAirport: "", toCity: "", departureAt: "", arrivalAt: "",
      }],
      passengers: [{
        title: "Mr",
        firstName: "",
        lastName: "",
        gender: "Male",
        paxType: "adult",
        handBaggage: "7 KG",
        cabinBaggagePreset: "7 KG",
        dateOfBirth: "",
        passportNumber: "",
        passportIssuingCountry: "",
        passportIssueDate: "",
        passportExpiryDate: "",
      }],
      propertyName: "", propertyAddress: "", city: "", propertyPhone: "", propertyEmail: "",
      checkIn: "", checkOut: "", checkInTime: "02:00 PM", checkOutTime: "12:00 PM",
      roomType: "", roomsCount: 1, mealPlan: "ROOM_ONLY", roomAmenities: [],
      adultsCount: 2, childrenCount: 0,
      inclusions: "", cancellationPolicy: "", includeCancellationPolicy: false,
      guests: [{ name: "", type: "adult", roomNumber: 1 }, { name: "", type: "adult", roomNumber: 1 }],
      rooms: [
        {
          roomNumber: 1,
          adultsCount: 2,
          childrenCount: 0,
          guests: [
            { name: "", type: "adult", roomNumber: 1 },
            { name: "", type: "adult", roomNumber: 1 },
          ],
        },
      ],
      operator: "", route: "", boardingPoint: "", droppingPoint: "",
      departureAt: "", arrivalAt: "",
      busPassengers: [{ name: "", seat: "" }],
      seats: [{ seatNumber: "" }],
    },
  });

  const { fields: segmentFields, append: appendSegment, remove: removeSegment } = useFieldArray({ control: form.control, name: "segments" });
  const { fields: passengerFields, append: appendPassenger, remove: removePassenger } = useFieldArray({ control: form.control, name: "passengers" });
  const { fields: guestFields, append: appendGuest } = useFieldArray({ control: form.control, name: "guests" });
  const { fields: busPaxFields, append: appendBusPax } = useFieldArray({ control: form.control, name: "busPassengers" });

  function applyTicketExtraction(result: ParsedTicketResult) {
    const nextProduct = result.productType;
    setProductType(nextProduct);
    form.setValue("productType", nextProduct);

    const fields = result.fields || {};
    const customerPatch = fields.customer as
      | { title?: string; name?: string; phone?: string; email?: string }
      | undefined;

    if (customerPatch) {
      const current = form.getValues("customer");
      form.setValue("customer", {
        ...current,
        title: customerPatch.title || current.title || "Mr",
        name: customerPatch.name?.trim() || current.name,
        phone: customerPatch.phone?.trim() || current.phone,
        email: customerPatch.email?.trim() || current.email,
      });
    }

    if (typeof fields.totalAmount === "number") {
      form.setValue("totalAmount", fields.totalAmount);
    }
    if (typeof fields.baseFare === "number") {
      form.setValue("baseFare", fields.baseFare);
    }

    if (nextProduct === "FLIGHT") {
      if (typeof fields.airline === "string" && fields.airline) {
        form.setValue("airline", fields.airline);
      }
      if (typeof fields.tripType === "string") {
        form.setValue("tripType", fields.tripType as WizardForm["tripType"]);
      }
      if (typeof fields.cabinClass === "string") {
        form.setValue("cabinClass", fields.cabinClass as WizardForm["cabinClass"]);
      }
      if (typeof fields.stopCount === "number") {
        form.setValue("stopCount", fields.stopCount);
      }
      if (Array.isArray(fields.segments) && fields.segments.length > 0) {
        form.setValue(
          "segments",
          fields.segments.map((s: Record<string, unknown>) => ({
            flightNumber: String(s.flightNumber || ""),
            airline: String(s.airline || fields.airline || "IndiGo"),
            fromAirport: String(s.fromAirport || ""),
            fromCity: String(s.fromCity || ""),
            toAirport: String(s.toAirport || ""),
            toCity: String(s.toCity || ""),
            departureAt: String(s.departureAt || ""),
            arrivalAt: String(s.arrivalAt || ""),
            pnr: s.pnr ? String(s.pnr) : undefined,
            terminal: s.terminal ? String(s.terminal) : undefined,
            departureTerminal: s.departureTerminal ? String(s.departureTerminal) : undefined,
          }))
        );
      }
      if (Array.isArray(fields.passengers) && fields.passengers.length > 0) {
        form.setValue(
          "passengers",
          fields.passengers.map((p: Record<string, unknown>) => ({
            title: String(p.title || "Mr"),
            firstName: String(p.firstName || ""),
            lastName: String(p.lastName || ""),
            gender: String(p.gender || "Male"),
            paxType: (p.paxType as "adult" | "child" | "infant") || "adult",
            ticketNumber: p.ticketNumber ? String(p.ticketNumber) : undefined,
            seat: p.seat ? String(p.seat) : undefined,
            handBaggage: String(p.handBaggage || "7 KG"),
            cabinBaggagePreset: String(p.cabinBaggagePreset || "7 KG"),
            dateOfBirth: "",
            passportNumber: "",
            passportIssuingCountry: "",
            passportIssueDate: "",
            passportExpiryDate: "",
          }))
        );
      }
    }

    if (nextProduct === "HOTEL") {
      for (const key of [
        "propertyName",
        "propertyAddress",
        "city",
        "roomType",
        "checkIn",
        "checkOut",
        "inclusions",
      ] as const) {
        if (typeof fields[key] === "string") form.setValue(key, fields[key] as string);
      }
      if (typeof fields.roomsCount === "number") form.setValue("roomsCount", fields.roomsCount);
      if (typeof fields.adultsCount === "number") form.setValue("adultsCount", fields.adultsCount);
      if (typeof fields.childrenCount === "number") form.setValue("childrenCount", fields.childrenCount);
      if (Array.isArray(fields.guests) && fields.guests.length > 0) {
        form.setValue(
          "guests",
          fields.guests.map((g: { name?: string; type?: "adult" | "child" }) => ({
            name: g.name || "",
            type: g.type || "adult",
          }))
        );
      }
    }

    if (nextProduct === "BUS") {
      for (const key of ["operator", "route", "boardingPoint", "droppingPoint", "departureAt", "arrivalAt"] as const) {
        if (typeof fields[key] === "string") form.setValue(key, fields[key] as string);
      }
      if (Array.isArray(fields.busPassengers) && fields.busPassengers.length > 0) {
        form.setValue(
          "busPassengers",
          fields.busPassengers.map((p: { name?: string; seat?: string; gender?: string }) => ({
            name: p.name || "",
            seat: p.seat || "",
            gender: p.gender,
          }))
        );
      }
      if (Array.isArray(fields.seats) && fields.seats.length > 0) {
        form.setValue(
          "seats",
          fields.seats.map((s: { seatNumber?: string }) => ({ seatNumber: s.seatNumber || "" }))
        );
      }
    }

    if (result.warnings.length) {
      const note = form.getValues("internalNotes") || "";
      const importNote = `Imported from ticket PDF (${result.confidence}). Review: ${result.warnings.join("; ")}`;
      if (!note.includes("Imported from ticket")) {
        form.setValue("internalNotes", note ? `${note}\n${importNote}` : importNote);
      }
    }
  }

  async function onSubmit(data: WizardForm) {
    setLoading(true);
    try {
      if (productType === "FLIGHT") {
        const isAddon = data.tripType === "ADDON_SERVICES";
        if (isAddon) {
          validateAddonBooking(
            data.addonType,
            data.passengers || [],
            data.addonCustomLabel,
            data.addonCustomValue
          );
          if ((data.baseFare ?? 0) + (data.serviceCharge ?? 0) <= 0) {
            throw new Error("Enter base fare and service charge for the add-on invoice");
          }
        } else if ((data.baseFare ?? 0) + (data.serviceCharge ?? 0) <= 0) {
          throw new Error("Enter base fare and service charge for the flight invoice");
        }
      }
      if (productType !== "FLIGHT" && data.totalAmount <= 0) {
        throw new Error("Total amount must be greater than 0");
      }
      const { title: _title, contactPerson, ...customerRest } = data.customer;
      const isCashCompany = data.billingType === "CASH" && data.cashBillTo === "COMPANY";
      const isLedgerCompany =
        data.billingType === "LEDGER" && data.ledgerMode === "NEW" && data.ledgerBillTo === "COMPANY";
      const formattedCustomer = {
        ...customerRest,
        name:
          isCashCompany || isLedgerCompany
            ? data.customer.name.trim()
            : formatCustomerName(data.customer.title, data.customer.name),
        phone: normalizePhone(customerRest.phone),
        email: data.customer.email?.trim() || undefined,
        pan: data.customer.pan?.trim().toUpperCase() || undefined,
        gstin: data.customer.gstin?.trim() || undefined,
        address: data.customer.address?.trim() || undefined,
        city: data.customer.city?.trim() || undefined,
        state: data.customer.state?.trim() || undefined,
        pincode: data.customer.pincode?.trim() || undefined,
        contactPerson:
          isCashCompany || isLedgerCompany ? contactPerson?.trim() || undefined : undefined,
      };
      const customerPayload =
        data.billingType === "LEDGER" && data.ledgerMode === "EXISTING"
          ? data.customerId
            ? formattedCustomer
            : undefined
          : formattedCustomer;

      const billingPayload = {
        billingType: data.billingType,
        cashBillTo: data.billingType === "CASH" ? data.cashBillTo || "INDIVIDUAL" : undefined,
        ledgerBillTo:
          data.billingType === "LEDGER" && data.ledgerMode === "NEW"
            ? data.ledgerBillTo || "INDIVIDUAL"
            : undefined,
        ledgerMode: data.billingType === "LEDGER" ? data.ledgerMode : undefined,
        customerId:
          data.billingType === "LEDGER" && data.ledgerMode === "EXISTING"
            ? data.customerId
            : undefined,
        customer: customerPayload,
      };

      let payload: Record<string, unknown>;

      if (productType === "FLIGHT") {
        const airline = data.airline?.trim() || "IndiGo";
        const isAddon = data.tripType === "ADDON_SERVICES";
        const segments = isAddon
          ? [buildAddonPlaceholderSegment(airline, data.addonFlightNumber, data.addonTravelDate)]
          : (data.segments || []).map((s) => ({
              ...s,
              airline,
              flightNumber: s.flightNumber?.trim() || "",
              fromAirport: s.fromAirport?.trim() || "",
              fromCity: s.fromCity?.trim() || "",
              toAirport: s.toAirport?.trim() || "",
              toCity: s.toCity?.trim() || "",
            }));

        const passengers = (data.passengers || []).map(({ baggagePreset, cabinBaggagePreset, ...p }) => {
          void baggagePreset;
          void cabinBaggagePreset;
          return p;
        });

        payload = {
          productType: "FLIGHT",
          channel: "OFFLINE",
          ...billingPayload,
          totalAmount: data.totalAmount,
          internalNotes: data.internalNotes,
          invoiceTaxType: data.invoiceTaxType || "NON_ITC",
          buyerGstin: (data.buyerGstin || data.customer.gstin || "").trim() || undefined,
          baseFare: data.baseFare ?? 0,
          serviceCharge: data.serviceCharge ?? 0,
          discountAmount: data.discountAmount ?? 0,
          invoiceNarration: data.invoiceNarration?.trim() || undefined,
          msmeNumber: data.msmeNumber?.trim() || undefined,
          tripType: data.tripType || "ONE_WAY",
          addonType: data.addonType,
          addonCustomLabel: data.addonCustomLabel?.trim() || undefined,
          addonCustomValue: data.addonCustomValue?.trim() || undefined,
          addonFlightNumber: data.addonFlightNumber?.trim() || undefined,
          addonTravelDate: data.addonTravelDate?.trim() || undefined,
          cabinClass: data.cabinClass || "ECONOMY",
          fareType: data.fareType || "NORMAL",
          paymentGatewayCharge: data.paymentGatewayCharge ?? 0,
          secondaryPnr:
            data.tripType === "ROUND_TRIP"
              ? data.segments?.[getReturnLegStartIndex(data.segments)]?.pnr?.trim() ||
                data.secondaryPnr?.trim() ||
                undefined
              : data.segments?.[1]?.pnr?.trim() || data.secondaryPnr?.trim() || undefined,
          showEticket: isAddon ? false : data.showEticket || false,
          showPassengerName: data.showPassengerName !== false,
          checkInAssistance: isAddon ? false : data.checkInAssistance || false,
          airline,
          segments,
          passengers,
          cancellationPolicy: data.cancellationPolicy?.trim() || undefined,
          includeCancellationPolicy: data.includeCancellationPolicy || false,
        };
      } else if (productType === "HOTEL") {
        const rooms = normalizeHotelRooms({
          rooms: data.rooms,
          roomsCount: data.roomsCount,
          adultsCount: data.adultsCount,
          childrenCount: data.childrenCount,
          guests: data.guests,
        });
        const roomTotals = totalsFromHotelRooms(rooms);
        if (data.totalAmount <= 0) {
          throw new Error("Enter hotel charges and service charge for the invoice");
        }
        payload = {
          productType: "HOTEL",
          channel: "OFFLINE",
          ...billingPayload,
          totalAmount: data.totalAmount,
          internalNotes: data.internalNotes,
          invoiceTaxType: data.invoiceTaxType || "NON_ITC",
          buyerGstin: (data.buyerGstin || data.customer.gstin || "").trim() || undefined,
          baseFare: data.baseFare ?? 0,
          serviceCharge: data.serviceCharge ?? 0,
          discountAmount: data.discountAmount || undefined,
          invoiceNarration: data.invoiceNarration?.trim() || undefined,
          msmeNumber: data.msmeNumber?.trim() || undefined,
          propertyName: data.propertyName,
          propertyAddress: data.propertyAddress,
          city: data.city,
          propertyPhone: data.propertyPhone,
          propertyEmail: data.propertyEmail?.trim() || undefined,
          checkIn: data.checkIn,
          checkOut: data.checkOut,
          checkInTime: data.checkInTime,
          checkOutTime: data.checkOutTime,
          roomType: data.roomType,
          roomsCount: roomTotals.roomsCount,
          mealPlan: data.mealPlan,
          roomAmenities: data.roomAmenities,
          adultsCount: roomTotals.adultsCount,
          childrenCount: roomTotals.childrenCount,
          guests: roomTotals.guests,
          rooms,
          inclusions: data.inclusions,
          cancellationPolicy: data.cancellationPolicy,
          includeCancellationPolicy: data.includeCancellationPolicy,
        };
      } else {
        payload = {
          productType: "BUS",
          channel: "OFFLINE",
          ...billingPayload,
          totalAmount: data.totalAmount,
          internalNotes: data.internalNotes,
          operator: data.operator,
          route: data.route,
          boardingPoint: data.boardingPoint,
          droppingPoint: data.droppingPoint,
          departureAt: data.departureAt,
          arrivalAt: data.arrivalAt,
          seats: data.seats,
          passengers: data.busPassengers,
        };
      }

      const res = await fetch("/api/crm/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const { ok, data: result, error } = await parseApiResponse(res);
      if (!ok) throw new Error(error);

      toast.success("Booking created successfully");
      router.push(`/bookings/${result.id as string}`);
    } catch (error) {
      if (error instanceof Error && error.message.includes("pattern")) {
        toast.error("Please check all fields - invalid email or date format.");
      } else {
        toast.error(error instanceof Error ? error.message : "Failed to create booking");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <form
      onSubmit={form.handleSubmit(onSubmit, (errors) => {
        toast.error(getFirstFormErrorMessage(errors));
      })}
      noValidate
      className="space-y-6"
    >
      <TicketUploadPanel productType={productType} onExtracted={applyTicketExtraction} />

      <Tabs value={productType} onValueChange={(v) => { setProductType(v as typeof productType); form.setValue("productType", v as typeof productType); }}>
        <TabsList>
          <TabsTrigger value="FLIGHT">Flight</TabsTrigger>
          <TabsTrigger value="HOTEL">Hotel</TabsTrigger>
          <TabsTrigger value="BUS">Bus</TabsTrigger>
        </TabsList>

        <CustomerBillingSection form={form} />

        <TabsContent value="FLIGHT">
          <Card>
            <CardHeader><CardTitle className="text-base">Flight Details</CardTitle></CardHeader>
            <CardContent>
              <FlightBookingFields
                form={form}
                segmentFields={segmentFields}
                appendSegment={appendSegment}
                removeSegment={removeSegment}
                passengerFields={passengerFields}
                appendPassenger={appendPassenger}
                removePassenger={removePassenger}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="HOTEL">
          <Card>
            <CardHeader><CardTitle className="text-base">Hotel Details</CardTitle></CardHeader>
            <CardContent>
              <HotelBookingFields form={form} guestFields={guestFields} appendGuest={appendGuest} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="BUS">
          <Card>
            <CardHeader><CardTitle className="text-base">Bus Details</CardTitle></CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <Input {...form.register("operator")} placeholder="Operator" />
              <Input {...form.register("route")} placeholder="Route" />
              <Input {...form.register("boardingPoint")} placeholder="Boarding Point" />
              <Input {...form.register("droppingPoint")} placeholder="Dropping Point" />
              <div className="space-y-2">
                <Label className="text-xs">Departure</Label>
                <FlightDateTimeInput
                  value={form.watch("departureAt") || ""}
                  onChange={(v) => form.setValue("departureAt", v, { shouldDirty: true })}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Arrival</Label>
                <FlightDateTimeInput
                  value={form.watch("arrivalAt") || ""}
                  onChange={(v) => form.setValue("arrivalAt", v, { shouldDirty: true })}
                />
              </div>
              {busPaxFields.map((field, i) => (
                <div key={field.id} className="flex gap-2 sm:col-span-2">
                  <Input {...form.register(`busPassengers.${i}.name`)} placeholder="Passenger Name" />
                  <Input {...form.register(`busPassengers.${i}.seat`)} placeholder="Seat" />
                </div>
              ))}
              <Button type="button" variant="outline" size="sm" onClick={() => appendBusPax({ name: "", seat: "" })}>
                <Plus className="mr-2 h-4 w-4" /> Add Passenger
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Card>
        <CardHeader><CardTitle className="text-base">Amount & Notes</CardTitle></CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          {productType === "FLIGHT" ? (
            <FlightInvoiceFields form={form} />
          ) : productType === "HOTEL" ? (
            <HotelInvoiceFields form={form} />
          ) : (
            <div className="space-y-2">
              <Label>Total Amount (INR) *</Label>
              <Input {...form.register("totalAmount")} type="number" />
            </div>
          )}
          <div className="space-y-2 sm:col-span-2">
            <Label>Internal Notes</Label>
            <Textarea {...form.register("internalNotes")} placeholder="WhatsApp conversation notes..." />
          </div>
        </CardContent>
      </Card>

      <Button type="submit" size="lg" disabled={loading}>
        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Create Booking (Processing)
      </Button>
    </form>
  );
}
