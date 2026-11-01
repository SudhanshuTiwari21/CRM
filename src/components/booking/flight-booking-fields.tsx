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
  FARE_TYPE_OPTIONS,
  ADDON_TYPE_OPTIONS,
  FLIGHT_ROUTE_TYPE_OPTIONS,
  LAYOVER_TYPE_OPTIONS,
  MEAL_OPTIONS,
  PAX_TYPE_OPTIONS,
  STOP_COUNT_OPTIONS,
  TRIP_TYPE_OPTIONS,
} from "@/lib/constants/flight";
import { computeLayoverDuration, getReturnLegStartIndex, isRoundTripLegBoundary } from "@/lib/flight-layover";
import { FormSettingToggle } from "@/components/booking/edit-form-section";
import { passportExpiryFromIssueDate } from "@/lib/passport-dates";
import { PASSPORT_ISSUING_COUNTRIES } from "@/lib/constants/passport";
import {
  SavedPassengerLoadDialog,
  SavedPassengerRowActions,
  useSavedPassengerActions,
} from "@/components/booking/saved-passenger-picker";
import { FlightCancellationPolicyFields } from "@/components/booking/flight-cancellation-policy-fields";
import { FlightDateTimeInput } from "@/components/booking/flight-datetime-input";

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
  const isInternational = Boolean(form.watch("showEticket"));
  const checkInAssistance = form.watch("checkInAssistance");

  const savedPassenger = useSavedPassengerActions(form, appendPassenger);
  const airline = form.watch("airline");
  const segments = form.watch("segments") || [];
  const stopCount = form.watch("stopCount") ?? Math.max(0, segmentFields.length - 1);
  const returnStopCount = form.watch("returnStopCount") ?? 0;

  function returnLegStartIndex() {
    return getReturnLegStartIndex(segments);
  }

  function shouldShowLayoverAfter(i: number) {
    if (i >= segmentFields.length - 1) return false;
    if (tripType !== "ROUND_TRIP") return true;
    const splitAt = returnLegStartIndex();
    return i < splitAt - 1 || i >= splitAt;
  }

  useEffect(() => {
    fetch("/api/crm/airlines")
      .then((r) => r.json())
      .then((d) => {
        const commonKeys = new Set(COMMON_AIRLINES.map((a) => a.name.toLowerCase()));
        const unique: { name: string; logoUrl?: string | null }[] = [];
        const seen = new Set<string>();
        for (const row of d.airlines || []) {
          const key = String(row.name || "").trim().toLowerCase();
          if (!key || seen.has(key) || commonKeys.has(key)) continue;
          seen.add(key);
          unique.push(row);
        }
        setSavedAirlines(unique);
      })
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

  // Auto-calculate layover duration between connected segments (skip round-trip leg boundary)
  useEffect(() => {
    for (let i = 0; i < segments.length - 1; i++) {
      if (tripType === "ROUND_TRIP" && isRoundTripLegBoundary(segments, i)) continue;
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
  }, [segments, form, tripType]);

  function handleTripTypeChange(value: string) {
    const wasRoundTrip = tripType === "ROUND_TRIP";
    form.setValue("tripType", value as WizardForm["tripType"]);
    if (value === "ADDON_SERVICES") {
      form.setValue("addonType", form.getValues("addonType") || "seat");
      form.setValue("checkInAssistance", false);
      form.setValue("stopCount", 0);
      form.setValue("returnStopCount", 0);
      return;
    }
    if (value === "ROUND_TRIP") {
      if (!wasRoundTrip) {
        form.setValue("stopCount", 0);
        form.setValue("returnStopCount", 0);
      }
      resizeRoundTripSegments(
        form.getValues("stopCount") ?? 0,
        form.getValues("returnStopCount") ?? 0
      );
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

  function resizeRoundTripSegments(outboundStops: number, returnStops: number) {
    const outboundCount = outboundStops + 1;
    const returnCount = returnStops + 1;
    const targetTotal = outboundCount + returnCount;
    const al = form.getValues("airline") || "";
    const current = form.getValues("segments") || [];

    if (current.length < targetTotal) {
      for (let i = current.length; i < targetTotal; i++) {
        const prev = form.getValues(`segments.${i - 1}`);
        appendSegment(
          emptySegment(al, prev ? { airport: prev.toAirport, city: prev.toCity } : undefined)
        );
      }
    } else if (current.length > targetTotal) {
      for (let i = current.length - 1; i >= targetTotal; i--) {
        removeSegment(i);
      }
    }

    for (let i = 0; i < targetTotal; i++) {
      form.setValue(`segments.${i}.direction`, i < outboundCount ? "outbound" : "return");
    }
  }

  function handleStopCountChange(stops: number) {
    if (tripType === "ROUND_TRIP") {
      form.setValue("stopCount", stops);
      resizeRoundTripSegments(stops, returnStopCount);
      return;
    }
    form.setValue("stopCount", stops);
    resizeSegments(stops + 1);
  }

  function handleReturnStopCountChange(stops: number) {
    form.setValue("returnStopCount", stops);
    resizeRoundTripSegments(stopCount, stops);
  }

  function segmentLabel(i: number) {
    if (tripType === "ROUND_TRIP") {
      const splitAt = returnLegStartIndex();
      const isReturn = i >= splitAt;
      const legIndex = isReturn ? i - splitAt + 1 : i + 1;
      const legCount = isReturn ? segmentFields.length - splitAt : splitAt;
      const prefix = isReturn ? "Return" : "Outbound";
      if (legCount === 1) return `${prefix} Flight`;
      return `${prefix} Flight ${legIndex} of ${legCount}`;
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
        {!isAddonTrip && (
        <div className="space-y-2">
          <Label>Fare Type</Label>
          <Select
            value={form.watch("fareType") || "NORMAL"}
            onValueChange={(v) => form.setValue("fareType", v as WizardForm["fareType"])}
          >
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {FARE_TYPE_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        )}
        {!isAddonTrip && (
        <div className="space-y-2">
          <Label>Domestic / International</Label>
          <Select
            value={isInternational ? "INTERNATIONAL" : "DOMESTIC"}
            onValueChange={(v) => form.setValue("showEticket", v === "INTERNATIONAL")}
          >
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {FLIGHT_ROUTE_TYPE_OPTIONS.map((o) => (
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
              <FlightDateTimeInput
                value={form.watch("addonTravelDate") || ""}
                onChange={(v) => form.setValue("addonTravelDate", v, { shouldDirty: true })}
              />
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
              : `${stopCount} connection(s) - fill each flight leg and layover details below`}
          </p>
        </div>
      )}

      {!isAddonTrip && tripType === "ROUND_TRIP" && (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Outbound Stops / Layovers</Label>
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
              {stopCount === 0 ? "Direct outbound" : `${stopCount} outbound connection(s)`}
            </p>
          </div>
          <div className="space-y-2">
            <Label>Return Stops / Layovers</Label>
            <Select
              value={String(returnStopCount)}
              onValueChange={(v) => handleReturnStopCountChange(Number(v))}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {STOP_COUNT_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={String(o.value)}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {returnStopCount === 0 ? "Direct return" : `${returnStopCount} return connection(s)`}
            </p>
          </div>
        </div>
      )}

      {!isAddonTrip && (
      <div className="grid gap-3 sm:grid-cols-2">
        <FormSettingToggle
          label="Check-in Booking Assistance"
          description="Admin gets email & WhatsApp alert 48 hours before departure"
          checked={Boolean(checkInAssistance)}
          onCheckedChange={(v) => form.setValue("checkInAssistance", v)}
        />
        <FormSettingToggle
          label="Special Assistance"
          description="Wheelchair / special assistance for passengers — set per traveller below"
          checked={(form.watch("passengers") || []).some((p) => Boolean(p?.wheelchairAssistance))}
          onCheckedChange={(v) => {
            const passengers = form.getValues("passengers") || [];
            if (passengers.length === 0) return;
            if (v) {
              const alreadyOn = passengers.some((p) => Boolean(p?.wheelchairAssistance));
              if (!alreadyOn) {
                form.setValue("passengers.0.wheelchairAssistance", true, { shouldDirty: true });
              }
            } else {
              passengers.forEach((_, idx) => {
                form.setValue(`passengers.${idx}.wheelchairAssistance`, false, { shouldDirty: true });
              });
            }
          }}
        />
      </div>
      )}

      {!isAddonTrip && segmentFields.map((field, i) => (
        <div key={field.id} className="space-y-3">
          {tripType === "ROUND_TRIP" && i === returnLegStartIndex() && (
            <div className="rounded-lg border border-dashed border-sky-300 bg-sky-50/50 px-4 py-3 text-sm dark:border-sky-700 dark:bg-sky-950/20">
              <p className="font-medium text-sky-900 dark:text-sky-100">Return Journey</p>
              <p className="text-xs text-muted-foreground">
                Outbound complete - enter return flight details below
              </p>
            </div>
          )}
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
              <div className="space-y-2">
                <Label className="text-xs">Flight Number</Label>
                <Input {...form.register(`segments.${i}.flightNumber`)} placeholder="6E 212" />
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Aircraft</Label>
                <Input {...form.register(`segments.${i}.aircraft`)} placeholder="A320" />
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Departure City</Label>
                <Input {...form.register(`segments.${i}.fromCity`)} placeholder="Kolkata" />
              </div>
              <div className="space-y-2">
                <Label className="text-xs">From Airport</Label>
                <Input {...form.register(`segments.${i}.fromAirport`)} placeholder="CCU" />
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Departure Terminal</Label>
                <Input {...form.register(`segments.${i}.departureTerminal`)} placeholder="Optional" />
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Departure</Label>
                <FlightDateTimeInput
                  value={form.watch(`segments.${i}.departureAt`) || ""}
                  onChange={(v) => form.setValue(`segments.${i}.departureAt`, v, { shouldDirty: true })}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Arrival City</Label>
                <Input {...form.register(`segments.${i}.toCity`)} placeholder="Delhi" />
              </div>
              <div className="space-y-2">
                <Label className="text-xs">To Airport</Label>
                <Input {...form.register(`segments.${i}.toAirport`)} placeholder="DEL" />
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Arrival Terminal</Label>
                <Input {...form.register(`segments.${i}.terminal`)} placeholder="Optional" />
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Arrival</Label>
                <FlightDateTimeInput
                  value={form.watch(`segments.${i}.arrivalAt`) || ""}
                  onChange={(v) => form.setValue(`segments.${i}.arrivalAt`, v, { shouldDirty: true })}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Duration</Label>
                <Input {...form.register(`segments.${i}.duration`)} placeholder="2h 15m" />
              </div>
              {(() => {
                if (tripType === "ROUND_TRIP") {
                  if (i === 0) return <div className="space-y-2"><Label className="text-xs">Outbound PNR</Label><Input {...form.register(`segments.${i}.pnr`)} placeholder="Optional" /></div>;
                  if (i === returnLegStartIndex()) return <div className="space-y-2"><Label className="text-xs">Return PNR</Label><Input {...form.register(`segments.${i}.pnr`)} placeholder="Optional" /></div>;
                  return null;
                }
                const segCount = form.watch("segments")?.length ?? 1;
                if (segCount <= 1) {
                  return <div className="space-y-2"><Label className="text-xs">PNR</Label><Input {...form.register(`segments.${i}.pnr`)} placeholder="Optional" /></div>;
                }
                return <div className="space-y-2"><Label className="text-xs">Segment PNR</Label><Input {...form.register(`segments.${i}.pnr`)} placeholder="Optional" /></div>;
              })()}
            </div>
          </div>

          {shouldShowLayoverAfter(i) && (
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
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Label className="text-base">Passengers</Label>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => savedPassenger.openLoad("new")}
          >
            <Plus className="mr-2 h-4 w-4" />
            Add from saved
          </Button>
        </div>
        {isInternational && !isAddonTrip && (
          <div className="rounded-lg border border-amber-200 bg-amber-50/80 px-4 py-3 text-sm text-amber-950 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100">
            <strong>Important:</strong> If the traveller&apos;s passport does not include a last name, leave the Last Name field empty.
          </div>
        )}
        {passengerFields.map((field, i) => {
          const paxType = form.watch(`passengers.${i}.paxType`) || "adult";
          const baggagePreset = form.watch(`passengers.${i}.baggagePreset`) || "";
          const cabinBaggagePreset = form.watch(`passengers.${i}.cabinBaggagePreset`) || "7 KG";
          const seat = form.watch(`passengers.${i}.seat`);
          return (
            <div key={field.id} className="space-y-3 rounded-lg border p-4">
              <div className="flex flex-wrap items-start gap-2">
                <div className="flex flex-wrap flex-1 gap-2">
                <div className="space-y-1">
                  <Label className="text-xs">{isInternational ? "Title *" : "Title"}</Label>
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
                </div>
                <div className="space-y-1 min-w-[120px] flex-1">
                  <Label className="text-xs">{isInternational ? "First & Middle Name *" : "First Name"}</Label>
                <Input
                  {...form.register(`passengers.${i}.firstName`)}
                  placeholder={isInternational ? "As on passport" : "First Name"}
                />
                </div>
                <div className="space-y-1 min-w-[120px] flex-1">
                  <Label className="text-xs">{isInternational ? "Last Name (optional)" : "Last Name"}</Label>
                <Input
                  {...form.register(`passengers.${i}.lastName`)}
                  placeholder={isInternational ? "Leave empty if not on passport" : "Last Name"}
                />
                </div>
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
                <SavedPassengerRowActions
                  index={i}
                  onSave={savedPassenger.handleSave}
                  onLoad={savedPassenger.openLoad}
                  saving={savedPassenger.savingIndex === i}
                />
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
                {isInternational && (
                  <div className="space-y-3 rounded-lg border border-blue-200 bg-blue-50/40 p-4 sm:col-span-2 dark:border-blue-900 dark:bg-blue-950/20">
                    <p className="text-sm font-medium text-blue-950 dark:text-blue-100">International traveller details</p>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label className="text-xs">Date of Birth *</Label>
                        <Input {...form.register(`passengers.${i}.dateOfBirth`)} type="date" required={isInternational} />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs">E-Ticket Number</Label>
                        <Input {...form.register(`passengers.${i}.ticketNumber`)} placeholder="176-1234567890" />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs">Passport No *</Label>
                        <Input
                          {...form.register(`passengers.${i}.passportNumber`)}
                          placeholder="Passport number"
                          className="uppercase"
                          required={isInternational}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs">Passport Issuing Country *</Label>
                        <Select
                          value={form.watch(`passengers.${i}.passportIssuingCountry`) || undefined}
                          onValueChange={(v) =>
                            form.setValue(`passengers.${i}.passportIssuingCountry`, v, {
                              shouldDirty: true,
                              shouldTouch: true,
                            })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select country" />
                          </SelectTrigger>
                          <SelectContent>
                            {PASSPORT_ISSUING_COUNTRIES.map((country) => (
                              <SelectItem key={country} value={country}>
                                {country}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs">Passport Issue Date *</Label>
                        <Input
                          type="date"
                          {...form.register(`passengers.${i}.passportIssueDate`, {
                            onChange: (e) => {
                              const value = e.target.value;
                              const expiry = passportExpiryFromIssueDate(value);
                              if (expiry) {
                                form.setValue(`passengers.${i}.passportExpiryDate`, expiry, {
                                  shouldDirty: true,
                                });
                              }
                            },
                          })}
                        />
                        <p className="text-xs text-muted-foreground">Expiry auto-fills as issue date + 15 years</p>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs">Passport Expiry *</Label>
                        <Input {...form.register(`passengers.${i}.passportExpiryDate`)} type="date" required={isInternational} />
                      </div>
                    </div>
                  </div>
                )}
                {!isAddonTrip && (() => {
                  const ffAirline = form.watch(`passengers.${i}.frequentFlyerAirline`) || "";
                  const ffNumber = form.watch(`passengers.${i}.frequentFlyerNumber`) || "";
                  const showFf = Boolean(ffAirline.trim() || ffNumber.trim());
                  return (
                    <div className="space-y-3 rounded-lg border border-dashed border-sky-200 bg-sky-50/30 p-3 sm:col-span-2 dark:border-sky-900 dark:bg-sky-950/10">
                      <FormSettingToggle
                        label="Add frequent flyer number"
                        description="Loyalty program ID for this passenger"
                        checked={showFf}
                        onCheckedChange={(v) => {
                          if (!v) {
                            form.setValue(`passengers.${i}.frequentFlyerAirline`, "");
                            form.setValue(`passengers.${i}.frequentFlyerNumber`, "");
                          } else if (!ffAirline.trim() && airline?.trim()) {
                            form.setValue(`passengers.${i}.frequentFlyerAirline`, airline.trim());
                          }
                        }}
                      />
                      {showFf && (
                        <div className="grid gap-3 sm:grid-cols-2">
                          <div className="space-y-2">
                            <Label className="text-xs">Frequent Flyer Airline</Label>
                            <Select
                              value={ffAirline || undefined}
                              onValueChange={(v) => form.setValue(`passengers.${i}.frequentFlyerAirline`, v)}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Select airline" />
                              </SelectTrigger>
                              <SelectContent>
                                {(() => {
                                  const names: string[] = [];
                                  const seen = new Set<string>();
                                  for (const raw of [
                                    airline?.trim(),
                                    ...COMMON_AIRLINES.map((a) => a.name),
                                    ...savedAirlines.map((a) => a.name),
                                    ffAirline.trim(),
                                  ]) {
                                    const name = (raw || "").trim();
                                    const key = name.toLowerCase();
                                    if (!name || seen.has(key)) continue;
                                    seen.add(key);
                                    names.push(name);
                                  }
                                  return names.map((name) => (
                                    <SelectItem key={name} value={name}>
                                      {name}
                                    </SelectItem>
                                  ));
                                })()}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label className="text-xs">Frequent Flyer No</Label>
                            <Input
                              {...form.register(`passengers.${i}.frequentFlyerNumber`)}
                              placeholder="Frequent flyer number"
                              className="font-mono"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })()}
                {!isAddonTrip && (
                  <div className="sm:col-span-2">
                    <FormSettingToggle
                      label="Special Assistance"
                      description="Wheelchair or other special assistance for this passenger"
                      checked={Boolean(form.watch(`passengers.${i}.wheelchairAssistance`))}
                      onCheckedChange={(v) =>
                        form.setValue(`passengers.${i}.wheelchairAssistance`, v, { shouldDirty: true })
                      }
                    />
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
              dateOfBirth: "",
              passportNumber: "",
              passportIssuingCountry: "",
              passportIssueDate: "",
              passportExpiryDate: "",
              wheelchairAssistance: false,
            })
          }
        >
          <Plus className="mr-2 h-4 w-4" /> Add Passenger
        </Button>

        <SavedPassengerLoadDialog
          open={savedPassenger.loadOpen}
          onOpenChange={savedPassenger.setLoadOpen}
          target={savedPassenger.target}
          search={savedPassenger.search}
          onSearchChange={savedPassenger.setSearch}
          loading={savedPassenger.loading}
          passengers={savedPassenger.passengers}
          onSelect={savedPassenger.handleSelect}
          onDelete={savedPassenger.handleDelete}
        />
      </div>

      {!isAddonTrip && <FlightCancellationPolicyFields form={form} />}
    </div>
  );
}
