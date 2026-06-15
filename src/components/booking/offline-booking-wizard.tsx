"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { HotelBookingFields } from "@/components/booking/hotel-booking-fields";
import { FlightInvoiceFields } from "@/components/booking/flight-invoice-fields";

const baseCustomer = {
  name: "",
  email: "",
  phone: "",
  gstin: "",
  address: "",
};

const wizardSchema = z.object({
  productType: z.enum(["FLIGHT", "HOTEL", "BUS"]),
  customer: z.object({
    name: z.string().min(2),
    email: z.string().optional(),
    phone: z.string().min(10),
    gstin: z.string().optional(),
    address: z.string().optional(),
  }),
  totalAmount: z.coerce.number().positive(),
  paymentMethod: z.string().optional(),
  internalNotes: z.string().optional(),
  invoiceTaxType: z.enum(["ITC", "NON_ITC"]).optional(),
  buyerGstin: z.string().optional(),
  baseFare: z.coerce.number().optional(),
  serviceCharge: z.coerce.number().optional(),
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
    aircraft: z.string().optional(),
    duration: z.string().optional(),
  })).optional(),
  passengers: z.array(z.object({
    title: z.string(),
    firstName: z.string(),
    lastName: z.string(),
    gender: z.string(),
    seat: z.string().optional(),
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
      airline: "IndiGo",
      segments: [{
        flightNumber: "", airline: "IndiGo", fromAirport: "", fromCity: "",
        toAirport: "", toCity: "", departureAt: "", arrivalAt: "",
      }],
      passengers: [{ title: "Mr", firstName: "", lastName: "", gender: "Male" }],
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

  const { fields: segmentFields, append: appendSegment } = useFieldArray({ control: form.control, name: "segments" });
  const { fields: passengerFields, append: appendPassenger, remove: removePassenger } = useFieldArray({ control: form.control, name: "passengers" });
  const { fields: guestFields, append: appendGuest } = useFieldArray({ control: form.control, name: "guests" });
  const { fields: busPaxFields, append: appendBusPax } = useFieldArray({ control: form.control, name: "busPassengers" });

  async function onSubmit(data: WizardForm) {
    setLoading(true);
    try {
      let payload: Record<string, unknown>;

      if (productType === "FLIGHT") {
        payload = {
          productType: "FLIGHT",
          channel: "OFFLINE",
          customer: data.customer,
          totalAmount: data.totalAmount,
          paymentMethod: data.paymentMethod,
          internalNotes: data.internalNotes,
          invoiceTaxType: data.invoiceTaxType || "NON_ITC",
          buyerGstin: data.buyerGstin || data.customer.gstin,
          baseFare: data.baseFare ?? 0,
          serviceCharge: data.serviceCharge ?? 0,
          airline: data.airline,
          segments: data.segments,
          passengers: data.passengers,
        };
      } else if (productType === "HOTEL") {
        payload = {
          productType: "HOTEL",
          channel: "OFFLINE",
          customer: data.customer,
          totalAmount: data.totalAmount,
          paymentMethod: data.paymentMethod,
          internalNotes: data.internalNotes,
          propertyName: data.propertyName,
          propertyAddress: data.propertyAddress,
          city: data.city,
          propertyPhone: data.propertyPhone,
          propertyEmail: data.propertyEmail,
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
          customer: data.customer,
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

      const result = await res.json();
      if (!res.ok) throw new Error(result.error);

      toast.success("Booking created successfully");
      router.push(`/bookings/${result.id}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create booking");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
      <Tabs value={productType} onValueChange={(v) => { setProductType(v as typeof productType); form.setValue("productType", v as typeof productType); }}>
        <TabsList>
          <TabsTrigger value="FLIGHT">Flight</TabsTrigger>
          <TabsTrigger value="HOTEL">Hotel</TabsTrigger>
          <TabsTrigger value="BUS">Bus</TabsTrigger>
        </TabsList>

        <Card className="mt-4">
          <CardHeader><CardTitle className="text-base">Customer Details</CardTitle></CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Name *</Label>
              <Input {...form.register("customer.name")} />
            </div>
            <div className="space-y-2">
              <Label>Phone *</Label>
              <Input {...form.register("customer.phone")} />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input {...form.register("customer.email")} type="email" />
            </div>
            <div className="space-y-2">
              <Label>GSTIN</Label>
              <Input {...form.register("customer.gstin")} />
            </div>
          </CardContent>
        </Card>

        <TabsContent value="FLIGHT">
          <Card>
            <CardHeader><CardTitle className="text-base">Flight Details</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Airline</Label>
                <Input {...form.register("airline")} placeholder="IndiGo" />
              </div>
              {segmentFields.map((field, i) => (
                <div key={field.id} className="grid gap-3 rounded-lg border p-4 sm:grid-cols-2">
                  <Input {...form.register(`segments.${i}.flightNumber`)} placeholder="Flight No (6E 212)" />
                  <Input {...form.register(`segments.${i}.fromCity`)} placeholder="From City" />
                  <Input {...form.register(`segments.${i}.fromAirport`)} placeholder="From Airport (CCU)" />
                  <Input {...form.register(`segments.${i}.toCity`)} placeholder="To City" />
                  <Input {...form.register(`segments.${i}.toAirport`)} placeholder="To Airport (GAU)" />
                  <Input {...form.register(`segments.${i}.departureAt`)} type="datetime-local" />
                  <Input {...form.register(`segments.${i}.arrivalAt`)} type="datetime-local" />
                  <Input {...form.register(`segments.${i}.aircraft`)} placeholder="Aircraft (A320)" />
                </div>
              ))}
              <Button type="button" variant="outline" size="sm" onClick={() => appendSegment({
                flightNumber: "", airline: form.getValues("airline") || "", fromAirport: "", fromCity: "",
                toAirport: "", toCity: "", departureAt: "", arrivalAt: "",
              })}>
                <Plus className="mr-2 h-4 w-4" /> Add Segment
              </Button>
            </CardContent>
          </Card>
          <Card className="mt-4">
            <CardHeader><CardTitle className="text-base">Passengers</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {passengerFields.map((field, i) => (
                <div key={field.id} className="flex gap-2">
                  <Select value={form.watch(`passengers.${i}.title`)} onValueChange={(v) => form.setValue(`passengers.${i}.title`, v)}>
                    <SelectTrigger className="w-20"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Mr">Mr</SelectItem>
                      <SelectItem value="Mrs">Mrs</SelectItem>
                      <SelectItem value="Ms">Ms</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input {...form.register(`passengers.${i}.firstName`)} placeholder="First Name" />
                  <Input {...form.register(`passengers.${i}.lastName`)} placeholder="Last Name" />
                  <Select value={form.watch(`passengers.${i}.gender`)} onValueChange={(v) => form.setValue(`passengers.${i}.gender`, v)}>
                    <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Male">Male</SelectItem>
                      <SelectItem value="Female">Female</SelectItem>
                    </SelectContent>
                  </Select>
                  {passengerFields.length > 1 && (
                    <Button type="button" variant="ghost" size="icon" onClick={() => removePassenger(i)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
              <Button type="button" variant="outline" size="sm" onClick={() => appendPassenger({ title: "Mr", firstName: "", lastName: "", gender: "Male" })}>
                <Plus className="mr-2 h-4 w-4" /> Add Passenger
              </Button>
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
              </SelectContent>
            </Select>
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
