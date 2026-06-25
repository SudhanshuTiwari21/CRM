"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useForm, useFieldArray } from "react-hook-form";
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
import { CUSTOMER_TITLE_OPTIONS } from "@/lib/constants/flight";

const baseCustomer = {
  title: "Mr",
  name: "",
  email: "",
  phone: "",
  gstin: "",
  address: "",
  state: "",
};

const wizardSchema = z.object({
  productType: z.enum(["FLIGHT", "HOTEL", "BUS"]),
  customer: z.object({
    title: z.string().optional(),
    name: z.string().min(2, "Customer name is required"),
    email: z.string().email("Invalid email").optional().or(z.literal("")),
    phone: z.string().min(10, "Phone must be at least 10 digits"),
    gstin: z.string().optional(),
    address: z.string().optional(),
    state: z.string().optional(),
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
  tripType: z.enum(["ONE_WAY", "ROUND_TRIP", "MULTI_CITY"]).optional(),
  cabinClass: z.enum(["ECONOMY", "PREMIUM_ECONOMY", "BUSINESS"]).optional(),
  secondaryPnr: z.string().optional(),
  showEticket: z.boolean().optional(),
  showPassengerName: z.boolean().optional(),
  checkInAssistance: z.boolean().optional(),
  stopCount: z.coerce.number().min(0).max(3).optional(),
  // Flight
  airline: z.string().optional(),
  segments: z.array(z.object({
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
  })).optional(),
  passengers: z.array(z.object({
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
  })).optional(),
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
});

type WizardForm = z.infer<typeof wizardSchema>;

export type { WizardForm };

export function OfflineBookingWizard() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [productType, setProductType] = useState<"FLIGHT" | "HOTEL" | "BUS">("FLIGHT");
  const [creditAvailable, setCreditAvailable] = useState(false);

  const form = useForm<WizardForm>({
    resolver: zodResolver(wizardSchema),
    defaultValues: {
      productType: "FLIGHT",
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
      cabinClass: "ECONOMY",
      stopCount: 0,
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
  const customerPhone = form.watch("customer.phone");

  useEffect(() => {
    const phone = customerPhone?.trim();
    if (!phone || phone.length < 10) {
      setCreditAvailable(false);
      return;
    }
    const timer = setTimeout(() => {
      fetch(`/api/crm/customers/credit-lookup?phone=${encodeURIComponent(phone)}`)
        .then((r) => r.json())
        .then((data) => setCreditAvailable(Boolean(data.customer?.creditEnabled)))
        .catch(() => setCreditAvailable(false));
    }, 400);
    return () => clearTimeout(timer);
  }, [customerPhone]);

  async function onSubmit(data: WizardForm) {
    setLoading(true);
    try {
      if (productType === "FLIGHT" && (data.baseFare ?? 0) + (data.serviceCharge ?? 0) <= 0) {
        throw new Error("Enter base fare and service charge for the flight invoice");
      }
      if (productType !== "FLIGHT" && data.totalAmount <= 0) {
        throw new Error("Total amount must be greater than 0");
      }
      const { title: _title, ...customerRest } = data.customer;
      const customer = {
        ...customerRest,
        name: formatCustomerName(data.customer.title, data.customer.name),
        email: data.customer.email?.trim() || undefined,
        gstin: data.customer.gstin?.trim() || undefined,
      };

      let payload: Record<string, unknown>;

      if (productType === "FLIGHT") {
        const airline = data.airline?.trim() || "IndiGo";
        const segments = (data.segments || []).map((s) => ({
          ...s,
          airline: s.airline || airline,
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
          customer,
          totalAmount: data.totalAmount,
          paymentMethod: data.paymentMethod,
          internalNotes: data.internalNotes,
          invoiceTaxType: data.invoiceTaxType || "NON_ITC",
          buyerGstin: (data.buyerGstin || customer.gstin || "").trim() || undefined,
          baseFare: data.baseFare ?? 0,
          serviceCharge: data.serviceCharge ?? 0,
          discountAmount: data.discountAmount ?? 0,
          invoiceNarration: data.invoiceNarration?.trim() || undefined,
          msmeNumber: data.msmeNumber?.trim() || undefined,
          tripType: data.tripType || "ONE_WAY",
          cabinClass: data.cabinClass || "ECONOMY",
          secondaryPnr: data.segments?.[1]?.pnr?.trim() || data.secondaryPnr?.trim() || undefined,
          showEticket: data.showEticket || false,
          showPassengerName: data.showPassengerName !== false,
          checkInAssistance: data.checkInAssistance || false,
          airline,
          segments,
          passengers,
        };
      } else if (productType === "HOTEL") {
        payload = {
          productType: "HOTEL",
          channel: "OFFLINE",
          customer,
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
          customer,
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
        const first = Object.values(errors)[0];
        const msg =
          (first as { message?: string })?.message ||
          "Please fill all required fields correctly.";
        toast.error(msg);
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

        <Card className="mt-4">
          <CardHeader><CardTitle className="text-base">Customer Details</CardTitle></CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label>Name *</Label>
              <div className="flex gap-2">
                <Select
                  value={form.watch("customer.title") || "Mr"}
                  onValueChange={(v) => form.setValue("customer.title", v)}
                >
                  <SelectTrigger className="w-[100px] shrink-0"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CUSTOMER_TITLE_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  {...form.register("customer.name")}
                  placeholder="Full name (without title)"
                  className="flex-1"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Phone *</Label>
              <Input {...form.register("customer.phone")} />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input {...form.register("customer.email")} type="text" inputMode="email" autoComplete="email" placeholder="optional" />
            </div>
            <div className="space-y-2">
              <Label>GSTIN</Label>
              <Input {...form.register("customer.gstin")} />
            </div>
            <div className="space-y-2">
              <Label>State</Label>
              <Input {...form.register("customer.state")} placeholder="West Bengal" />
            </div>
          </CardContent>
        </Card>

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
            <Select onValueChange={(v) => form.setValue("paymentMethod", v)}>
              <SelectTrigger><SelectValue placeholder="Select method" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="UPI">UPI</SelectItem>
                <SelectItem value="Cash">Cash</SelectItem>
                <SelectItem value="Card">Card</SelectItem>
                <SelectItem value="Bank Transfer">Bank Transfer</SelectItem>
                {creditAvailable && <SelectItem value="CREDIT">On Credit</SelectItem>}
              </SelectContent>
            </Select>
            {creditAvailable && (
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
