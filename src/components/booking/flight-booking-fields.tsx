"use client";

import { useEffect, useState } from "react";
import type { UseFormReturn, UseFieldArrayReturn } from "react-hook-form";
import { Plus, Trash2 } from "lucide-react";
import type { WizardForm } from "@/components/booking/offline-booking-wizard";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  BAGGAGE_PRESETS,
  CABIN_CLASS_OPTIONS,
  COMMON_AIRLINES,
  MEAL_OPTIONS,
  PAX_TYPE_OPTIONS,
  TRIP_TYPE_OPTIONS,
} from "@/lib/constants/flight";

interface FlightBookingFieldsProps {
  form: UseFormReturn<WizardForm>;
  segmentFields: UseFieldArrayReturn<WizardForm, "segments">["fields"];
  appendSegment: UseFieldArrayReturn<WizardForm, "segments">["append"];
  removeSegment: UseFieldArrayReturn<WizardForm, "segments">["remove"];
  passengerFields: UseFieldArrayReturn<WizardForm, "passengers">["fields"];
  appendPassenger: UseFieldArrayReturn<WizardForm, "passengers">["append"];
  removePassenger: UseFieldArrayReturn<WizardForm, "passengers">["remove"];
}

export function FlightBookingFields({
  form,
  segmentFields,
  appendSegment,
  removeSegment,
  passengerFields,
  appendPassenger,
  removePassenger,
}: FlightBookingFieldsProps) {
  const [airlineLogo, setAirlineLogo] = useState<string | null>(null);
  const [savedAirlines, setSavedAirlines] = useState<{ name: string; logoUrl?: string | null }[]>([]);
  const tripType = form.watch("tripType") || "ONE_WAY";
  const showEticket = form.watch("showEticket");
  const airline = form.watch("airline");

  useEffect(() => {
    fetch("/api/crm/airlines")
      .then((r) => r.json())
      .then((d) => setSavedAirlines(d.airlines || []))
      .catch(() => setSavedAirlines([]));
  }, []);

  useEffect(() => {
    const name = airline?.trim();
    if (!name || name.length < 2) {
      setAirlineLogo(null);
      return;
    }
    const timer = setTimeout(async () => {
      const res = await fetch(`/api/crm/airlines/lookup?name=${encodeURIComponent(name)}`);
      const data = await res.json();
      setAirlineLogo(data.logoUrl || null);
    }, 400);
    return () => clearTimeout(timer);
  }, [airline]);

  function handleTripTypeChange(value: string) {
    form.setValue("tripType", value as WizardForm["tripType"]);
    if (value === "ROUND_TRIP" && segmentFields.length < 2) {
      const first = form.getValues("segments.0");
      appendSegment({
        flightNumber: "",
        airline: form.getValues("airline") || "",
        fromAirport: first?.toAirport || "",
        fromCity: first?.toCity || "",
        toAirport: first?.fromAirport || "",
        toCity: first?.fromCity || "",
        departureAt: "",
        arrivalAt: "",
        direction: "return",
      });
      form.setValue("segments.0.direction", "outbound");
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>Trip Type</Label>
          <Select value={tripType} onValueChange={handleTripTypeChange}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {TRIP_TYPE_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Cabin Class</Label>
          <Select
            value={form.watch("cabinClass") || "ECONOMY"}
            onValueChange={(v) => form.setValue("cabinClass", v as WizardForm["cabinClass"])}
          >
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {CABIN_CLASS_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label>Airline</Label>
        <div className="flex items-center gap-3">
          {airlineLogo && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={airlineLogo} alt="" className="h-10 w-10 rounded border object-contain bg-white p-1" />
          )}
          <Input {...form.register("airline")} placeholder="IndiGo" list="airline-suggestions" className="flex-1" />
          <datalist id="airline-suggestions">
            {COMMON_AIRLINES.map((a) => (
              <option key={a.iata} value={a.name} />
            ))}
            {savedAirlines.map((a) => (
              <option key={a.name} value={a.name} />
            ))}
          </datalist>
        </div>
      </div>

      <div className="flex items-center justify-between rounded-lg border p-3">
        <div>
          <Label>E-Ticket Number (International)</Label>
          <p className="text-xs text-muted-foreground">Show e-ticket field for passengers when enabled</p>
        </div>
        <Button
          type="button"
          variant={showEticket ? "default" : "outline"}
          size="sm"
          onClick={() => form.setValue("showEticket", !showEticket)}
        >
          {showEticket ? "Yes" : "No"}
        </Button>
      </div>

      {segmentFields.map((field, i) => (
        <div key={field.id} className="space-y-3 rounded-lg border p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">
              {tripType === "ROUND_TRIP"
                ? i === 0
                  ? "Outbound"
                  : "Return"
                : `Segment ${i + 1}`}
            </p>
            {segmentFields.length > 1 && (
              <Button type="button" variant="ghost" size="icon" onClick={() => removeSegment(i)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Input {...form.register(`segments.${i}.flightNumber`)} placeholder="Flight No (6E 212)" />
            <Input {...form.register(`segments.${i}.fromCity`)} placeholder="From City" />
            <Input {...form.register(`segments.${i}.fromAirport`)} placeholder="From Airport (CCU)" />
            <Input {...form.register(`segments.${i}.toCity`)} placeholder="To City" />
            <Input {...form.register(`segments.${i}.toAirport`)} placeholder="To Airport (GAU)" />
            <Input {...form.register(`segments.${i}.departureAt`)} type="datetime-local" step="60" />
            <Input {...form.register(`segments.${i}.arrivalAt`)} type="datetime-local" step="60" />
            <Input {...form.register(`segments.${i}.aircraft`)} placeholder="Aircraft (A320)" />
            {tripType === "ROUND_TRIP" && (
              <Input
                {...form.register(`segments.${i}.pnr`)}
                placeholder={i === 0 ? "Outbound PNR (optional)" : "Return PNR (optional)"}
              />
            )}
          </div>
        </div>
      ))}

      {tripType !== "ROUND_TRIP" && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() =>
            appendSegment({
              flightNumber: "",
              airline: form.getValues("airline") || "",
              fromAirport: "",
              fromCity: "",
              toAirport: "",
              toCity: "",
              departureAt: "",
              arrivalAt: "",
            })
          }
        >
          <Plus className="mr-2 h-4 w-4" /> Add Segment
        </Button>
      )}

      <div className="space-y-3">
        <Label className="text-base">Passengers</Label>
        {passengerFields.map((field, i) => {
          const paxType = form.watch(`passengers.${i}.paxType`) || "adult";
          const baggagePreset = form.watch(`passengers.${i}.baggagePreset`) || "";
          const seat = form.watch(`passengers.${i}.seat`);
          return (
            <div key={field.id} className="space-y-3 rounded-lg border p-4">
              <div className="flex flex-wrap gap-2">
                <Select
                  value={form.watch(`passengers.${i}.title`)}
                  onValueChange={(v) => form.setValue(`passengers.${i}.title`, v)}
                >
                  <SelectTrigger className="w-20"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Mr">Mr</SelectItem>
                    <SelectItem value="Mrs">Mrs</SelectItem>
                    <SelectItem value="Ms">Ms</SelectItem>
                    <SelectItem value="Mstr">Mstr</SelectItem>
                    <SelectItem value="Miss">Miss</SelectItem>
                  </SelectContent>
                </Select>
                <Input {...form.register(`passengers.${i}.firstName`)} placeholder="First Name" className="min-w-[120px] flex-1" />
                <Input {...form.register(`passengers.${i}.lastName`)} placeholder="Last Name" className="min-w-[120px] flex-1" />
                <Select
                  value={form.watch(`passengers.${i}.gender`)}
                  onValueChange={(v) => form.setValue(`passengers.${i}.gender`, v)}
                >
                  <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Male">Male</SelectItem>
                    <SelectItem value="Female">Female</SelectItem>
                  </SelectContent>
                </Select>
                <Select
                  value={paxType}
                  onValueChange={(v) => form.setValue(`passengers.${i}.paxType`, v as "adult" | "child" | "infant")}
                >
                  <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PAX_TYPE_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {passengerFields.length > 1 && (
                  <Button type="button" variant="ghost" size="icon" onClick={() => removePassenger(i)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label className="text-xs">Seat</Label>
                  <Input {...form.register(`passengers.${i}.seat`)} placeholder="e.g. 12A" />
                </div>
                {seat && (
                  <div className="space-y-2">
                    <Label className="text-xs">Meal Preference</Label>
                    <Select
                      value={form.watch(`passengers.${i}.meal`) || "none"}
                      onValueChange={(v) => form.setValue(`passengers.${i}.meal`, v as "veg" | "nonveg" | "none")}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {MEAL_OPTIONS.map((o) => (
                          <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <div className="space-y-2">
                  <Label className="text-xs">Check-in Baggage</Label>
                  <Select
                    value={baggagePreset}
                    onValueChange={(v) => {
                      form.setValue(`passengers.${i}.baggagePreset`, v);
                      if (v !== "Custom") form.setValue(`passengers.${i}.checkInBaggage`, v);
                    }}
                  >
                    <SelectTrigger><SelectValue placeholder="Select baggage" /></SelectTrigger>
                    <SelectContent>
                      {BAGGAGE_PRESETS.map((b) => (
                        <SelectItem key={b} value={b}>{b}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {baggagePreset === "Custom" && (
                  <div className="space-y-2">
                    <Label className="text-xs">Custom Baggage</Label>
                    <Input {...form.register(`passengers.${i}.checkInBaggage`)} placeholder="e.g. 30 KG" />
                  </div>
                )}
                {showEticket && (
                  <div className="space-y-2 sm:col-span-2">
                    <Label className="text-xs">E-Ticket Number</Label>
                    <Input {...form.register(`passengers.${i}.ticketNumber`)} placeholder="176-1234567890" />
                  </div>
                )}
              </div>
            </div>
          );
        })}
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() =>
            appendPassenger({
              title: "Mr",
              firstName: "",
              lastName: "",
              gender: "Male",
              paxType: "adult",
            })
          }
        >
          <Plus className="mr-2 h-4 w-4" /> Add Passenger
        </Button>
      </div>
    </div>
  );
}
