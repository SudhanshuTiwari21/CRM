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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { HotelBookingFields } from "@/components/booking/hotel-booking-fields";
import { FlightBookingFields } from "@/components/booking/flight-booking-fields";
import { FlightInvoiceFields } from "@/components/booking/flight-invoice-fields";
import { parseApiResponse } from "@/lib/parse-api-response";
import { formatCustomerName } from "@/lib/utils";
import { getFirstFormErrorMessage } from "@/lib/form-errors";
import { buildAddonPlaceholderSegment, validateAddonBooking } from "@/lib/flight-addon";
import { getReturnLegStartIndex } from "@/lib/flight-layover";
import { CustomerBillingSection } from "@/components/booking/customer-billing-section";
import {
  flightPassengerSchema,
  flightSegmentSchema,
  refineInternationalPassengers,
  refineOfflineBilling,
} from "@/lib/validators/booking";
import { normalizePhone } from "@/lib/phone";

const baseCustomer = {
  title: "Mr",
  name: "",
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
  ledgerMode: z.enum(["EXISTING", "NEW"]).optional(),
  customerId: z.string().optional(),
  customer: z.object({
    title: z.string().optional(),
    name: z.string(),
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
  paymentMethod: z.string().optional(),
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
  inclusions: z.string().optional(),
  cancellationPolicy: z.string().optional(),
  includeCancellationPolicy: z.boolean().optional(),
  guests: z.array(z.object({ name: z.string(), type: z.enum(["adult", "child"]) })).optional(),
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
  const [creditAvailable, setCreditAvailable] = useState(false);

  const form = useForm<WizardForm>({
    resolver: wizardResolver,
    defaultValues: {
      productType: "FLIGHT",
      billingType: "LEDGER",
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
      passengers: [{ title: "Mr", firstName: "", lastName: "", gender: "Male", paxType: "adult", handBaggage: "7 KG", cabinBaggagePreset: "7 KG" }],
      propertyName: "", propertyAddress: "", city: "", propertyPhone: "", propertyEmail: "",
      checkIn: "", checkOut: "", checkInTime: "02:00 PM", checkOutTime: "12:00 PM",
      roomType: "", roomsCount: 1, mealPlan: "ROOM_ONLY", roomAmenities: [],
      inclusions: "", cancellationPolicy: "", includeCancellationPolicy: false,
      guests: [{ name: "", type: "adult" }],
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
  const billingType = form.watch("billingType");

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
      const { title: _title, ...customerRest } = data.customer;
      const formattedCustomer = {
        ...customerRest,
        name: formatCustomerName(data.customer.title, data.customer.name),
        phone: normalizePhone(customerRest.phone),
        email: data.customer.email?.trim() || undefined,
        pan: data.customer.pan?.trim().toUpperCase() || undefined,
        gstin: data.customer.gstin?.trim() || undefined,
        address: data.customer.address?.trim() || undefined,
        city: data.customer.city?.trim() || undefined,
        state: data.customer.state?.trim() || undefined,
        pincode: data.customer.pincode?.trim() || undefined,
      };
      const customerPayload =
        data.billingType === "LEDGER" && data.ledgerMode === "EXISTING"
          ? data.customerId
            ? formattedCustomer
            : undefined
          : formattedCustomer;

      const billingPayload = {
        billingType: data.billingType,
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
          paymentMethod: data.paymentMethod,
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
        payload = {
          productType: "HOTEL",
          channel: "OFFLINE",
          ...billingPayload,
          totalAmount: data.totalAmount,
          paymentMethod: data.paymentMethod,
          internalNotes: data.internalNotes,
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
          roomsCount: data.roomsCount,
          mealPlan: data.mealPlan,
          roomAmenities: data.roomAmenities,
          guests: data.guests,
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
          paymentMethod: data.paymentMethod,
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
        toast.error("Please check all fields — invalid email or date format.");
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
      <Tabs value={productType} onValueChange={(v) => { setProductType(v as typeof productType); form.setValue("productType", v as typeof productType); }}>
        <TabsList>
          <TabsTrigger value="FLIGHT">Flight</TabsTrigger>
          <TabsTrigger value="HOTEL">Hotel</TabsTrigger>
          <TabsTrigger value="BUS">Bus</TabsTrigger>
        </TabsList>

        <CustomerBillingSection
          form={form}
          onCreditAvailabilityChange={setCreditAvailable}
        />

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
              <Input {...form.register("departureAt")} type="datetime-local" />
              <Input {...form.register("arrivalAt")} type="datetime-local" />
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
        <CardHeader><CardTitle className="text-base">Payment & Notes</CardTitle></CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          {productType === "FLIGHT" ? (
            <FlightInvoiceFields form={form} />
          ) : (
            <div className="space-y-2">
              <Label>Total Amount (INR) *</Label>
              <Input {...form.register("totalAmount")} type="number" />
            </div>
          )}
          <div className="space-y-2">
            <Label>Payment Method</Label>
            <Select
              value={form.watch("paymentMethod") || undefined}
              onValueChange={(v) => form.setValue("paymentMethod", v)}
            >
              <SelectTrigger><SelectValue placeholder="Select method" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="UPI">UPI</SelectItem>
                <SelectItem value="Cash">Cash</SelectItem>
                <SelectItem value="Card">Card</SelectItem>
                <SelectItem value="Bank Transfer">Bank Transfer</SelectItem>
                {creditAvailable && billingType === "LEDGER" && (
                  <SelectItem value="CREDIT">On Credit</SelectItem>
                )}
              </SelectContent>
            </Select>
            {form.watch("paymentMethod") === "Card" && Number(form.watch("paymentGatewayCharge") || 0) > 0 && (
              <p className="text-xs text-muted-foreground">
                Card payment gateway charge (2.5%): ₹
                {Number(form.watch("paymentGatewayCharge")).toLocaleString("en-IN", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}{" "}
                added automatically to the booking total.
              </p>
            )}
            {creditAvailable && billingType === "LEDGER" && (
              <p className="text-xs text-muted-foreground">Credit account enabled for this customer</p>
            )}
          </div>
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
