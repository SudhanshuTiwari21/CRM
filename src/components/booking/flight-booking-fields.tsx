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
  CABIN_BAGGAGE_PRESETS,
  CABIN_CLASS_OPTIONS,
  COMMON_AIRLINES,
  ADDON_TYPE_OPTIONS,
  LAYOVER_TYPE_OPTIONS,
  MEAL_OPTIONS,
  PAX_TYPE_OPTIONS,
  STOP_COUNT_OPTIONS,
  TRIP_TYPE_OPTIONS,
} from "@/lib/constants/flight";
import { computeLayoverDuration } from "@/lib/flight-layover";

interface FlightBookingFieldsProps {
  form: UseFormReturn<WizardForm>;
  segmentFields: UseFieldArrayReturn<WizardForm, "segments">["fields"];
  appendSegment: UseFieldArrayReturn<WizardForm, "segments">["append"];
  removeSegment: UseFieldArrayReturn<WizardForm, "segments">["remove"];
  passengerFields: UseFieldArrayReturn<WizardForm, "passengers">["fields"];
  appendPassenger: UseFieldArrayReturn<WizardForm, "passengers">["append"];
  removePassenger: UseFieldArrayReturn<WizardForm, "passengers">["remove"];
}

function emptySegment(airline: string, from?: { airport: string; city: string }) {
  return {
    flightNumber: "",
    airline,
    fromAirport: from?.airport || "",
    fromCity: from?.city || "",
    toAirport: "",
    toCity: "",
    departureAt: "",
    arrivalAt: "",
    layoverType: "connection" as const,
  };
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
  const isAddonTrip = tripType === "ADDON_SERVICES";
  const addonType = form.watch("addonType") || "seat";
  const showEticket = form.watch("showEticket");
  const checkInAssistance = form.watch("checkInAssistance");
  const airline = form.watch("airline");
  const segments = form.watch("segments") || [];
  const stopCount = form.watch("stopCount") ?? Math.max(0, segmentFields.length - 1);

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

  useEffect(() => {
    const al = airline?.trim();
    if (!al) return;
    const segs = form.getValues("segments") || [];
    segs.forEach((_, i) => {
      if (form.getValues(`segments.${i}.airline`) !== al) {
        form.setValue(`segments.${i}.airline`, al, { shouldDirty: true });
      }
    });
  }, [airline, form]);

  // Auto-calculate layover duration between connected segments
  useEffect(() => {
    for (let i = 0; i < segments.length - 1; i++) {
      const seg = segments[i];
      const next = segments[i + 1];
      if (!seg?.arrivalAt || !next?.departureAt) continue;
      const computed = computeLayoverDuration(seg.arrivalAt, next.departureAt);
      if (computed && !form.getValues(`segments.${i}.layoverDuration`)) {
        form.setValue(`segments.${i}.layoverDuration`, computed);
      }
      if (seg.toCity && !form.getValues(`segments.${i}.layoverCity`)) {
        form.setValue(`segments.${i}.layoverCity`, seg.toCity);
      }
      if (seg.toAirport && !form.getValues(`segments.${i}.layoverAirport`)) {
        form.setValue(`segments.${i}.layoverAirport`, seg.toAirport);
      }
    }
  }, [segments, form]);

  function handleTripTypeChange(value: string) {
    form.setValue("tripType", value as WizardForm["tripType"]);
    if (value === "ADDON_SERVICES") {
      form.setValue("addonType", form.getValues("addonType") || "seat");
      form.setValue("checkInAssistance", false);
      form.setValue("stopCount", 0);
      return;
    }
    if (value === "ROUND_TRIP") {
      form.setValue("stopCount", 0);
      if (segmentFields.length < 2) {
        const first = form.getValues("segments.0");
        appendSegment(
          emptySegment(form.getValues("airline") || "", {
            airport: first?.toAirport || "",
            city: first?.toCity || "",
          })
        );
        form.setValue("segments.0.direction", "outbound");
        form.setValue("segments.1.direction", "return");
      }
    } else if (value === "ONE_WAY") {
      const target = (form.getValues("stopCount") ?? 0) + 1;
      resizeSegments(target);
    }
  }

  function resizeSegments(targetCount: number) {
    const current = form.getValues("segments") || [];
    const al = form.getValues("airline") || "";

    if (current.length < targetCount) {
      for (let i = current.length; i < targetCount; i++) {
        const prev = current[i - 1];
        appendSegment(
          emptySegment(al, prev ? { airport: prev.toAirport, city: prev.toCity } : undefined)
        );
      }
    } else if (current.length > targetCount) {
      for (let i = current.length - 1; i >= targetCount; i--) {
        removeSegment(i);
      }
    }
  }

  function handleStopCountChange(stops: number) {
    form.setValue("stopCount", stops);
    resizeSegments(stops + 1);
  }

  function segmentLabel(i: number) {
    if (tripType === "ROUND_TRIP") {
      return i === 0 ? "Outbound Flight" : "Return Flight";
    }
    if (segmentFields.length === 1) return "Flight";
    return `Flight ${i + 1} of ${segmentFields.length}`;
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
        {!isAddonTrip && (
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
        )}
      </div>

      {isAddonTrip ? (
        <div className="space-y-4 rounded-lg border-2 border-violet-200 bg-violet-50/40 p-4 dark:border-violet-800 dark:bg-violet-950/20">
          <div className="space-y-2">
            <Label>Airline</Label>
            <div className="flex items-center gap-3">
              {airlineLogo && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={airlineLogo} alt="" className="h-10 w-10 rounded border object-contain bg-white p-1" />
              )}
              <Input {...form.register("airline")} placeholder="IndiGo" list="airline-suggestions-addon" className="flex-1" />
              <datalist id="airline-suggestions-addon">
                {COMMON_AIRLINES.map((a) => (
                  <option key={a.iata} value={a.name} />
                ))}
                {savedAirlines.map((a) => (
                  <option key={a.name} value={a.name} />
                ))}
              </datalist>
            </div>
          </div>

          <div>
            <Label className="text-base">Add-on Service Type</Label>
            <p className="text-xs text-muted-foreground mb-2">
              Book seat selection, meal, or other services for an existing ticket. Use the invoice section below for base fare and service charge (same as regular bookings).
            </p>
            <Select
              value={addonType}
              onValueChange={(v) => form.setValue("addonType", v as WizardForm["addonType"])}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {ADDON_TYPE_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {addonType === "custom" && (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Custom Service Label</Label>
                <Input {...form.register("addonCustomLabel")} placeholder="e.g. Extra Baggage" />
              </div>
              <div className="space-y-2">
                <Label>Custom Service Details</Label>
                <Input {...form.register("addonCustomValue")} placeholder="e.g. 15 KG extra baggage" />
              </div>
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Reference Flight No (optional)</Label>
              <Input {...form.register("addonFlightNumber")} placeholder="6E 212" />
            </div>
            <div className="space-y-2">
              <Label>Travel Date (optional)</Label>
              <Input {...form.register("addonTravelDate")} type="datetime-local" step="60" />
            </div>
          </div>
        </div>
      ) : null}

      {!isAddonTrip && (
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
      )}

      {!isAddonTrip && tripType === "ONE_WAY" && (
        <div className="space-y-2">
          <Label>Stops / Layovers</Label>
          <Select
            value={String(stopCount)}
            onValueChange={(v) => handleStopCountChange(Number(v))}
          >
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {STOP_COUNT_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={String(o.value)}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            {stopCount === 0
              ? "Direct non-stop flight"
              : `${stopCount} connection(s) — fill each flight leg and layover details below`}
          </p>
        </div>
      )}

      {!isAddonTrip && (
      <div className="flex items-center justify-between rounded-lg border p-3">
        <div>
          <Label>Check-in Booking Assistance</Label>
          <p className="text-xs text-muted-foreground">
            Admin gets email & WhatsApp alert 48 hours before departure
          </p>
        </div>
        <Button
          type="button"
          variant={checkInAssistance ? "default" : "outline"}
          size="sm"
          onClick={() => form.setValue("checkInAssistance", !checkInAssistance)}
        >
          {checkInAssistance ? "Yes" : "No"}
        </Button>
      </div>
      )}

      {!isAddonTrip && (
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
      )}

      {!isAddonTrip && segmentFields.map((field, i) => (
        <div key={field.id} className="space-y-3">
          <div className="space-y-3 rounded-lg border p-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">{segmentLabel(i)}</p>
              {tripType === "MULTI_CITY" && segmentFields.length > 1 && (
                <Button type="button" variant="ghost" size="icon" onClick={() => removeSegment(i)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Input {...form.register(`segments.${i}.flightNumber`)} placeholder="Flight No (6E 212)" />
              <Input {...form.register(`segments.${i}.aircraft`)} placeholder="Aircraft (A320)" />
              <Input {...form.register(`segments.${i}.fromCity`)} placeholder="From City" />
              <Input {...form.register(`segments.${i}.fromAirport`)} placeholder="From Airport (CCU)" />
              <Input {...form.register(`segments.${i}.departureTerminal`)} placeholder="Dep Terminal (optional)" />
              <Input {...form.register(`segments.${i}.departureAt`)} type="datetime-local" step="60" />
              <Input {...form.register(`segments.${i}.toCity`)} placeholder="To City" />
              <Input {...form.register(`segments.${i}.toAirport`)} placeholder="To Airport (DEL)" />
              <Input {...form.register(`segments.${i}.terminal`)} placeholder="Arr Terminal (optional)" />
              <Input {...form.register(`segments.${i}.arrivalAt`)} type="datetime-local" step="60" />
              <Input {...form.register(`segments.${i}.duration`)} placeholder="Duration (e.g. 2h 15m)" />
              {tripType === "ROUND_TRIP" && (
                <Input
                  {...form.register(`segments.${i}.pnr`)}
                  placeholder={i === 0 ? "Outbound PNR (optional)" : "Return PNR (optional)"}
                />
              )}
            </div>
          </div>

          {i < segmentFields.length - 1 && (
            <div className="ml-4 space-y-3 rounded-lg border-2 border-dashed border-amber-300 bg-amber-50/50 p-4 dark:border-amber-700 dark:bg-amber-950/20">
              <p className="text-sm font-medium text-amber-900 dark:text-amber-100">
                Layover after {segments[i]?.toCity || "this flight"}
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label className="text-xs">Layover Type</Label>
                  <Select
                    value={form.watch(`segments.${i}.layoverType`) || "connection"}
                    onValueChange={(v) =>
                      form.setValue(`segments.${i}.layoverType`, v as "connection" | "plane_change" | "technical")
                    }
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {LAYOVER_TYPE_OPTIONS.map((o) => (
                        <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Layover Duration</Label>
                  <Input
                    {...form.register(`segments.${i}.layoverDuration`)}
                    placeholder="Auto from times or e.g. 2h 35m"
                  />
                </div>
                <Input {...form.register(`segments.${i}.layoverCity`)} placeholder="Layover City" />
                <Input {...form.register(`segments.${i}.layoverAirport`)} placeholder="Layover Airport (DEL)" />
                <Input {...form.register(`segments.${i}.layoverTerminal`)} placeholder="Connection Terminal" />
                <Input {...form.register(`segments.${i}.layoverNote`)} placeholder="Note (e.g. Change of gates)" />
              </div>
            </div>
          )}
        </div>
      ))}

      {!isAddonTrip && tripType === "MULTI_CITY" && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            const last = segments[segments.length - 1];
            appendSegment(
              emptySegment(form.getValues("airline") || "", last ? { airport: last.toAirport, city: last.toCity } : undefined)
            );
            form.setValue("stopCount", segmentFields.length);
          }}
        >
          <Plus className="mr-2 h-4 w-4" /> Add Flight Leg
        </Button>
      )}

      <div className="space-y-3">
        <Label className="text-base">Passengers</Label>
        {passengerFields.map((field, i) => {
          const paxType = form.watch(`passengers.${i}.paxType`) || "adult";
          const baggagePreset = form.watch(`passengers.${i}.baggagePreset`) || "";
          const cabinBaggagePreset = form.watch(`passengers.${i}.cabinBaggagePreset`) || "7 KG";
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
                  <Label className="text-xs">
                    {isAddonTrip
                      ? addonType === "seat"
                        ? "Seat Number *"
                        : "Seat Number (optional)"
                      : "Seat"}
                  </Label>
                  <Input {...form.register(`passengers.${i}.seat`)} placeholder="e.g. 12A" />
                </div>
                {(!isAddonTrip && seat) || (isAddonTrip && addonType === "food") ? (
                  <div className="space-y-2">
                    <Label className="text-xs">{isAddonTrip ? "Meal Preference *" : "Meal Preference"}</Label>
                    <Select
                      value={form.watch(`passengers.${i}.meal`) || (isAddonTrip ? "veg" : "none")}
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
                ) : null}
                {!isAddonTrip && (
                <>
                <div className="space-y-2">
                  <Label className="text-xs">Cabin Baggage</Label>
                  <Select
                    value={cabinBaggagePreset}
                    onValueChange={(v) => {
                      form.setValue(`passengers.${i}.cabinBaggagePreset`, v);
                      if (v !== "Custom") form.setValue(`passengers.${i}.handBaggage`, v);
                    }}
                  >
                    <SelectTrigger><SelectValue placeholder="Select cabin baggage" /></SelectTrigger>
                    <SelectContent>
                      {CABIN_BAGGAGE_PRESETS.map((b) => (
                        <SelectItem key={b} value={b}>{b}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {cabinBaggagePreset === "Custom" && (
                  <div className="space-y-2">
                    <Label className="text-xs">Custom Cabin Baggage</Label>
                    <Input {...form.register(`passengers.${i}.handBaggage`)} placeholder="e.g. 1 piece X 8 kg" />
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
                </>
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
              handBaggage: "7 KG",
              cabinBaggagePreset: "7 KG",
            })
          }
        >
          <Plus className="mr-2 h-4 w-4" /> Add Passenger
        </Button>
      </div>
    </div>
  );
}
