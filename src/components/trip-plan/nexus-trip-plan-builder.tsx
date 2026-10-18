"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ArrowLeft,
  Building2,
  Car,
  Check,
  Loader2,
  Plane,
  Plus,
  Save,
  Send,
  Shield,
  Trash2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CityAutocomplete } from "@/components/ui/city-autocomplete";
import { DEFAULT_TRIP_TERMS } from "@/lib/constants/trip-plan";
import { formatCurrency } from "@/lib/utils";
import { parseApiResponse } from "@/lib/parse-api-response";
import { computeNexusTotals, mapNexusToTripPlanPayload } from "@/lib/nexus-trip-plan-mapper";
import {
  buildCityDayMap,
  newId,
  parseNexusItinerary,
  totalNights,
  type NexusDayActivity,
  type NexusItineraryState,
  type TimeOfDay,
} from "@/lib/trip-plan-itinerary";
import type { TripPlanStatus } from "@prisma/client";

type LeadInfo = {
  id: string;
  name: string;
  queryRef?: string | null;
  destinations?: string | null;
  travelDate?: string | Date | null;
  returnDate?: string | Date | null;
  adultCount?: number | null;
  childCount?: number | null;
  infantCount?: number | null;
};

type CatalogActivity = {
  id: string;
  city: string;
  name: string;
  description: string | null;
  tag: string | null;
  startTimes: string | null;
  duration: string | null;
  costPrice: number | string;
  sellPrice: number | string;
};

type NavKey = "flights" | "transfers" | "insurance" | string; // string = city name

function toDateInput(value?: string | Date | null) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function cityInitial(city: string) {
  return (city.trim()[0] || "?").toUpperCase();
}

export function NexusTripPlanBuilder({
  leadId,
  lead,
  initialPlan,
}: {
  leadId: string;
  lead: LeadInfo;
  initialPlan?: {
    id: string;
    version: number;
    status: TripPlanStatus;
    title: string;
    travelDate?: string;
    adultCount?: string;
    childCount?: string;
    infantCount?: string;
    offerPrice?: string;
    inclusions?: string;
    exclusions?: string;
    terms?: string;
    internalNotes?: string;
    leavingFrom?: string | null;
    nationality?: string | null;
    roomCount?: number | null;
    destinations?: string | null;
    itineraryJson?: unknown;
  };
}) {
  const router = useRouter();
  const [step, setStep] = useState<"details" | "customize">(
    initialPlan?.itineraryJson ? "customize" : "details"
  );
  const [detailsOpen, setDetailsOpen] = useState(!initialPlan?.itineraryJson);
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [planId, setPlanId] = useState(initialPlan?.id);
  const [version, setVersion] = useState(initialPlan?.version ?? 1);
  const [status, setStatus] = useState<TripPlanStatus>(initialPlan?.status ?? "DRAFT");

  const [title, setTitle] = useState(
    initialPlan?.title ||
      (lead.destinations ? `Trip to ${lead.destinations}` : `${lead.name} Package`)
  );
  const [travelDate, setTravelDate] = useState(
    initialPlan?.travelDate || toDateInput(lead.travelDate)
  );
  const [adultCount, setAdultCount] = useState(
    Number(initialPlan?.adultCount || lead.adultCount || 2)
  );
  const [childCount, setChildCount] = useState(
    Number(initialPlan?.childCount || lead.childCount || 0)
  );
  const [infantCount, setInfantCount] = useState(
    Number(initialPlan?.infantCount || lead.infantCount || 0)
  );
  const [inclusions, setInclusions] = useState(initialPlan?.inclusions || "");
  const [exclusions, setExclusions] = useState(initialPlan?.exclusions || "");
  const [terms, setTerms] = useState(initialPlan?.terms || DEFAULT_TRIP_TERMS);
  const [internalNotes, setInternalNotes] = useState(initialPlan?.internalNotes || "");

  const [itinerary, setItinerary] = useState<NexusItineraryState>(() => {
    const base = parseNexusItinerary(
      initialPlan?.itineraryJson,
      initialPlan?.destinations || lead.destinations
    );
    if (initialPlan?.leavingFrom) base.leavingFrom = initialPlan.leavingFrom;
    if (initialPlan?.nationality) base.nationality = initialPlan.nationality;
    if (initialPlan?.roomCount) base.roomCount = initialPlan.roomCount;
    return base;
  });

  const cities = itinerary.destinations.map((d) => d.city).filter(Boolean);
  const [activeNav, setActiveNav] = useState<NavKey>(cities[0] || "flights");
  const [catalog, setCatalog] = useState<CatalogActivity[]>([]);
  const [activityPicker, setActivityPicker] = useState<{
    dayNumber: number;
    city: string;
    timeOfDay: TimeOfDay;
  } | null>(null);
  const [manualActivity, setManualActivity] = useState({ title: "", sellPrice: "0", description: "" });

  const nights = totalNights(itinerary.destinations);
  const cityDays = useMemo(() => buildCityDayMap(itinerary.destinations), [itinerary.destinations]);
  const totals = useMemo(() => computeNexusTotals(itinerary), [itinerary]);
  const perAdult = adultCount > 0 ? totals.sell / adultCount : totals.sell;

  useEffect(() => {
    if (!cities.includes(activeNav) && activeNav !== "flights" && activeNav !== "transfers" && activeNav !== "insurance") {
      setActiveNav(cities[0] || "flights");
    }
  }, [cities, activeNav]);

  useEffect(() => {
    if (!activityPicker) return;
    fetch(
      `/api/crm/activities?activeOnly=true&city=${encodeURIComponent(activityPicker.city)}`,
      { credentials: "include" }
    )
      .then((r) => r.json())
      .then((d) => setCatalog(Array.isArray(d.activities) ? d.activities : []))
      .catch(() => setCatalog([]));
  }, [activityPicker]);

  function updateDestination(index: number, patch: Partial<{ city: string; nights: number }>) {
    setItinerary((prev) => ({
      ...prev,
      destinations: prev.destinations.map((d, i) => (i === index ? { ...d, ...patch } : d)),
    }));
  }

  function applyDetailsAndContinue() {
    if (!itinerary.leavingFrom.trim()) {
      toast.error("Leaving from city is required");
      return;
    }
    if (!itinerary.destinations.some((d) => d.city.trim())) {
      toast.error("Add at least one destination city");
      return;
    }
    if (!travelDate) {
      toast.error("Leaving on date is required");
      return;
    }
    const firstCity = itinerary.destinations.find((d) => d.city.trim())?.city;
    setTitle((t) => (t.trim() ? t : `Trip to ${firstCity}`));
    setActiveNav(firstCity || "flights");
    setDetailsOpen(false);
    setStep("customize");
  }

  function addHotelForCity(city: string) {
    setItinerary((prev) => ({
      ...prev,
      hotels: [
        ...prev.hotels,
        {
          id: newId(),
          city,
          stayType: "Hotel - Own Arrangement",
          hotelName: "",
          description: "",
          costPrice: 0,
          sellPrice: 0,
        },
      ],
    }));
  }

  function addTransferForCity(city: string) {
    setItinerary((prev) => ({
      ...prev,
      transfers: [
        ...prev.transfers,
        {
          id: newId(),
          city,
          title: "One-way Transfer",
          details: "Private Vehicle (6 am - 10 pm)",
          costPrice: 0,
          sellPrice: 0,
        },
      ],
    }));
  }

  function addActivityFromCatalog(act: CatalogActivity) {
    if (!activityPicker) return;
    const item: NexusDayActivity = {
      id: newId(),
      city: activityPicker.city,
      dayNumber: activityPicker.dayNumber,
      timeOfDay: activityPicker.timeOfDay,
      title: act.name,
      description: act.description || "",
      tag: act.tag || "",
      startTimes: act.startTimes || "",
      duration: act.duration || "",
      activityId: act.id,
      costPrice: Number(act.costPrice) || 0,
      sellPrice: Number(act.sellPrice) || 0,
    };
    setItinerary((prev) => ({ ...prev, activities: [...prev.activities, item] }));
    setActivityPicker(null);
  }

  function addManualActivity() {
    if (!activityPicker || !manualActivity.title.trim()) {
      toast.error("Activity name is required");
      return;
    }
    const item: NexusDayActivity = {
      id: newId(),
      city: activityPicker.city,
      dayNumber: activityPicker.dayNumber,
      timeOfDay: activityPicker.timeOfDay,
      title: manualActivity.title.trim(),
      description: manualActivity.description,
      tag: "",
      startTimes: "",
      duration: "",
      costPrice: 0,
      sellPrice: Number(manualActivity.sellPrice) || 0,
    };
    setItinerary((prev) => ({ ...prev, activities: [...prev.activities, item] }));
    setManualActivity({ title: "", sellPrice: "0", description: "" });
    setActivityPicker(null);
  }

  async function save(send: boolean) {
    const payload = mapNexusToTripPlanPayload({
      title,
      travelDate,
      adultCount,
      childCount,
      infantCount,
      offerPrice: totals.sell,
      inclusions,
      exclusions,
      terms,
      internalNotes,
      itinerary,
    });

    if (send) {
      setSending(true);
    } else {
      setSaving(true);
    }

    try {
      let id = planId;
      if (!id) {
        const res = await fetch(`/api/crm/leads/${leadId}/trip-plans`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const { ok, data, error } = await parseApiResponse(res);
        if (!ok) throw new Error(error || "Create failed");
        id = data.id as string;
        setPlanId(id);
        setVersion(data.version as number);
        router.replace(`/leads/${leadId}/trip-plan/${id}`);
      } else {
        const res = await fetch(`/api/crm/trip-plans/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(send ? { ...payload, status: "SENT" } : payload),
        });
        const { ok, data, error } = await parseApiResponse(res);
        if (!ok) throw new Error(error || "Save failed");
        setStatus(data.status as TripPlanStatus);
      }

      if (send && id) {
        if (!planId) {
          const res = await fetch(`/api/crm/trip-plans/${id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status: "SENT" }),
          });
          const { ok, error } = await parseApiResponse(res);
          if (!ok) throw new Error(error || "Send failed");
          setStatus("SENT");
        }
        toast.success("Proposal saved and marked as sent");
      } else {
        toast.success("Trip plan saved");
      }
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
      setSending(false);
    }
  }

  const activeCity = cities.includes(activeNav) ? activeNav : null;
  const daysForCity = cityDays.filter((d) => d.city === activeCity);

  return (
    <div className="space-y-4">
      {/* Step indicator */}
      <div className="flex flex-wrap items-center gap-4 rounded-lg border bg-card px-4 py-3">
        <Link href={`/leads/${leadId}`} className="text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="flex items-center gap-2 text-sm">
          <span className={`flex items-center gap-1 ${step === "customize" ? "text-emerald-600" : "font-medium"}`}>
            {step === "customize" ? <Check className="h-4 w-4" /> : <span className="font-semibold">1</span>}
            Your Trip Details
          </span>
          <span className="text-muted-foreground">→</span>
          <span className={step === "customize" ? "font-semibold text-primary" : "text-muted-foreground"}>
            2 Customize Your Trip
          </span>
        </div>
        <div className="ml-auto text-xs text-muted-foreground">
          {lead.queryRef || lead.name} · V{version} · {status}
        </div>
      </div>

      {step === "customize" && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border bg-muted/30 px-4 py-3 text-sm">
          <span>{travelDate ? new Date(travelDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—"}</span>
          <span>·</span>
          <span>{nights} nights</span>
          <span>·</span>
          <span>
            {itinerary.roomCount} room · {adultCount} adults
            {childCount ? ` · ${childCount} children` : ""}
          </span>
          <span className="ml-auto font-semibold">{formatCurrency(totals.sell)}</span>
          <Button variant="outline" size="sm" onClick={() => setDetailsOpen(true)}>
            Update trip details
          </Button>
        </div>
      )}

      {step === "customize" && (
        <div className="grid gap-4 lg:grid-cols-[72px_1fr_280px]">
          {/* Left nav */}
          <div className="flex flex-row gap-2 overflow-x-auto lg:flex-col lg:overflow-visible">
            <NavIcon
              active={activeNav === "flights"}
              label="Flights"
              onClick={() => setActiveNav("flights")}
            >
              <Plane className="h-4 w-4" />
            </NavIcon>
            {cities.map((city) => (
              <NavIcon
                key={city}
                active={activeNav === city}
                label={city}
                onClick={() => setActiveNav(city)}
              >
                <span className="text-sm font-semibold">{cityInitial(city)}</span>
              </NavIcon>
            ))}
            <NavIcon
              active={activeNav === "transfers"}
              label="Transfers"
              onClick={() => setActiveNav("transfers")}
            >
              <Car className="h-4 w-4" />
            </NavIcon>
            <NavIcon
              active={activeNav === "insurance"}
              label="Insurance"
              onClick={() => setActiveNav("insurance")}
            >
              <Shield className="h-4 w-4" />
            </NavIcon>
          </div>

          {/* Main */}
          <div className="space-y-4 rounded-lg border bg-card p-4">
            {activeNav === "flights" && (
              <section className="space-y-3">
                <h2 className="text-lg font-semibold">Flights</h2>
                {itinerary.flights.length === 0 && (
                  <div className="rounded-lg border border-dashed p-6 text-center">
                    <p className="text-sm text-muted-foreground">No Flight Included</p>
                    <Button
                      className="mt-3"
                      onClick={() =>
                        setItinerary((prev) => ({
                          ...prev,
                          flights: [
                            ...prev.flights,
                            {
                              id: newId(),
                              title: `Flights ${itinerary.leavingFrom || "Origin"} – ${cities.join(" / ")}`,
                              description: "",
                              costPrice: 0,
                              sellPrice: 0,
                            },
                          ],
                        }))
                      }
                    >
                      Add flights to my trip
                    </Button>
                  </div>
                )}
                {itinerary.flights.map((f) => (
                  <div key={f.id} className="space-y-2 rounded-lg border p-4">
                    <div className="flex justify-between gap-2">
                      <Input
                        value={f.title}
                        onChange={(e) =>
                          setItinerary((prev) => ({
                            ...prev,
                            flights: prev.flights.map((x) =>
                              x.id === f.id ? { ...x, title: e.target.value } : x
                            ),
                          }))
                        }
                        placeholder="Flight title"
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() =>
                          setItinerary((prev) => ({
                            ...prev,
                            flights: prev.flights.filter((x) => x.id !== f.id),
                          }))
                        }
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                    <Textarea
                      rows={2}
                      value={f.description}
                      placeholder="Manual flight notes / sectors"
                      onChange={(e) =>
                        setItinerary((prev) => ({
                          ...prev,
                          flights: prev.flights.map((x) =>
                            x.id === f.id ? { ...x, description: e.target.value } : x
                          ),
                        }))
                      }
                    />
                    <div className="grid gap-2 sm:grid-cols-2">
                      <div>
                        <Label>Cost</Label>
                        <Input
                          type="number"
                          value={f.costPrice}
                          onChange={(e) =>
                            setItinerary((prev) => ({
                              ...prev,
                              flights: prev.flights.map((x) =>
                                x.id === f.id ? { ...x, costPrice: Number(e.target.value) || 0 } : x
                              ),
                            }))
                          }
                        />
                      </div>
                      <div>
                        <Label>Sell price</Label>
                        <Input
                          type="number"
                          value={f.sellPrice}
                          onChange={(e) =>
                            setItinerary((prev) => ({
                              ...prev,
                              flights: prev.flights.map((x) =>
                                x.id === f.id ? { ...x, sellPrice: Number(e.target.value) || 0 } : x
                              ),
                            }))
                          }
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </section>
            )}

            {activeCity && (
              <section className="space-y-6">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="text-lg font-semibold">
                    Stay in {activeCity}{" "}
                    {itinerary.destinations.find((d) => d.city === activeCity)?.nights || 0} nights
                  </h2>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => addHotelForCity(activeCity)}>
                      <Building2 className="mr-1 h-3.5 w-3.5" />
                      Add / change hotel
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => addTransferForCity(activeCity)}>
                      <Car className="mr-1 h-3.5 w-3.5" />
                      Add transfer
                    </Button>
                  </div>
                </div>

                {itinerary.hotels.filter((h) => h.city === activeCity).length === 0 && (
                  <p className="rounded-md border border-dashed px-3 py-4 text-sm text-muted-foreground">
                    No stay included — add hotel details manually.
                  </p>
                )}

                {itinerary.hotels
                  .filter((h) => h.city === activeCity)
                  .map((h) => (
                    <div key={h.id} className="space-y-2 rounded-lg border p-4">
                      <div className="flex justify-between">
                        <Label>Hotel (manual)</Label>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() =>
                            setItinerary((prev) => ({
                              ...prev,
                              hotels: prev.hotels.filter((x) => x.id !== h.id),
                            }))
                          }
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                      <Input
                        value={h.hotelName}
                        placeholder="Choose / type hotel name"
                        onChange={(e) =>
                          setItinerary((prev) => ({
                            ...prev,
                            hotels: prev.hotels.map((x) =>
                              x.id === h.id ? { ...x, hotelName: e.target.value } : x
                            ),
                          }))
                        }
                      />
                      <Input
                        value={h.stayType}
                        onChange={(e) =>
                          setItinerary((prev) => ({
                            ...prev,
                            hotels: prev.hotels.map((x) =>
                              x.id === h.id ? { ...x, stayType: e.target.value } : x
                            ),
                          }))
                        }
                      />
                      <div className="grid gap-2 sm:grid-cols-2">
                        <div>
                          <Label>Cost</Label>
                          <Input
                            type="number"
                            value={h.costPrice}
                            onChange={(e) =>
                              setItinerary((prev) => ({
                                ...prev,
                                hotels: prev.hotels.map((x) =>
                                  x.id === h.id ? { ...x, costPrice: Number(e.target.value) || 0 } : x
                                ),
                              }))
                            }
                          />
                        </div>
                        <div>
                          <Label>Sell price</Label>
                          <Input
                            type="number"
                            value={h.sellPrice}
                            onChange={(e) =>
                              setItinerary((prev) => ({
                                ...prev,
                                hotels: prev.hotels.map((x) =>
                                  x.id === h.id ? { ...x, sellPrice: Number(e.target.value) || 0 } : x
                                ),
                              }))
                            }
                          />
                        </div>
                      </div>
                    </div>
                  ))}

                {itinerary.transfers
                  .filter((t) => t.city === activeCity)
                  .map((t) => (
                    <div key={t.id} className="space-y-2 rounded-lg border p-4">
                      <div className="flex justify-between">
                        <Label>Transfer (manual)</Label>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() =>
                            setItinerary((prev) => ({
                              ...prev,
                              transfers: prev.transfers.filter((x) => x.id !== t.id),
                            }))
                          }
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                      <Input
                        value={t.title}
                        onChange={(e) =>
                          setItinerary((prev) => ({
                            ...prev,
                            transfers: prev.transfers.map((x) =>
                              x.id === t.id ? { ...x, title: e.target.value } : x
                            ),
                          }))
                        }
                      />
                      <Input
                        value={t.details}
                        placeholder="Private Vehicle (6 am - 10 pm)"
                        onChange={(e) =>
                          setItinerary((prev) => ({
                            ...prev,
                            transfers: prev.transfers.map((x) =>
                              x.id === t.id ? { ...x, details: e.target.value } : x
                            ),
                          }))
                        }
                      />
                      <div className="grid gap-2 sm:grid-cols-2">
                        <div>
                          <Label>Cost</Label>
                          <Input
                            type="number"
                            value={t.costPrice}
                            onChange={(e) =>
                              setItinerary((prev) => ({
                                ...prev,
                                transfers: prev.transfers.map((x) =>
                                  x.id === t.id ? { ...x, costPrice: Number(e.target.value) || 0 } : x
                                ),
                              }))
                            }
                          />
                        </div>
                        <div>
                          <Label>Sell price</Label>
                          <Input
                            type="number"
                            value={t.sellPrice}
                            onChange={(e) =>
                              setItinerary((prev) => ({
                                ...prev,
                                transfers: prev.transfers.map((x) =>
                                  x.id === t.id ? { ...x, sellPrice: Number(e.target.value) || 0 } : x
                                ),
                              }))
                            }
                          />
                        </div>
                      </div>
                    </div>
                  ))}

                {daysForCity.map(({ dayNumber, city }) => (
                  <div key={`${city}-${dayNumber}`} className="space-y-3 rounded-lg border p-4">
                    <h3 className="font-semibold">
                      Day {dayNumber}
                      {travelDate
                        ? `: ${new Date(
                            new Date(travelDate).getTime() + (dayNumber - 1) * 86400000
                          ).toLocaleDateString("en-IN", {
                            weekday: "short",
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                          })}`
                        : ""}
                    </h3>
                    <div className="grid gap-3 md:grid-cols-3">
                      {(["MORNING", "AFTERNOON", "EVENING"] as TimeOfDay[]).map((slot) => {
                        const items = itinerary.activities.filter(
                          (a) => a.dayNumber === dayNumber && a.timeOfDay === slot
                        );
                        return (
                          <div key={slot} className="rounded-md border bg-muted/20 p-3">
                            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                              {slot.toLowerCase()}
                            </p>
                            <div className="space-y-2">
                              {items.map((a) => (
                                <div key={a.id} className="rounded border bg-background p-2 text-sm">
                                  <div className="flex justify-between gap-1">
                                    <p className="font-medium">{a.title}</p>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setItinerary((prev) => ({
                                          ...prev,
                                          activities: prev.activities.filter((x) => x.id !== a.id),
                                        }))
                                      }
                                    >
                                      <X className="h-3.5 w-3.5 text-muted-foreground" />
                                    </button>
                                  </div>
                                  {a.tag && <Badge variant="secondary" className="mt-1">{a.tag}</Badge>}
                                  <p className="mt-1 text-xs font-medium text-primary">
                                    + {formatCurrency(a.sellPrice)}
                                  </p>
                                </div>
                              ))}
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="w-full border-emerald-300 text-emerald-700 hover:bg-emerald-50"
                                onClick={() =>
                                  setActivityPicker({ dayNumber, city, timeOfDay: slot })
                                }
                              >
                                <Plus className="mr-1 h-3.5 w-3.5" />
                                Add Activity
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </section>
            )}

            {activeNav === "transfers" && (
              <section className="space-y-3">
                <h2 className="text-lg font-semibold">All transfers</h2>
                <p className="text-sm text-muted-foreground">
                  Manage transfers under each city tab, or add from here.
                </p>
                {cities.map((city) => (
                  <Button key={city} variant="outline" size="sm" onClick={() => addTransferForCity(city)}>
                    Add transfer in {city}
                  </Button>
                ))}
              </section>
            )}

            {activeNav === "insurance" && (
              <section className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
                Insurance can be added as a priced line later. For now use city activities / notes, or add a
                transfer/hotel sell amount that includes cover.
              </section>
            )}
          </div>

          {/* Right summary */}
          <aside className="space-y-3">
            <div className="rounded-lg border bg-card p-4">
              <p className="text-sm text-muted-foreground">Price per adult</p>
              <p className="text-xl font-bold">{formatCurrency(perAdult)}</p>
              <p className="mt-2 text-sm text-muted-foreground">Total Price</p>
              <p className="text-2xl font-bold">{formatCurrency(totals.sell)}</p>
              <Button className="mt-4 w-full" onClick={() => void save(true)} disabled={saving || sending}>
                {sending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                Save As Proposal
              </Button>
              <Button
                variant="outline"
                className="mt-2 w-full"
                onClick={() => void save(false)}
                disabled={saving || sending}
              >
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                Save draft
              </Button>
            </div>
            <div className="max-h-[480px] space-y-3 overflow-y-auto rounded-lg border bg-card p-4 text-sm">
              <p className="font-semibold">Trip Summary</p>
              {itinerary.destinations
                .filter((d) => d.city)
                .map((d) => (
                  <div key={d.id}>
                    <p className="font-medium">{d.city}</p>
                    <ul className="mt-1 list-disc space-y-1 pl-4 text-muted-foreground">
                      <li>
                        {d.nights} night{d.nights === 1 ? "" : "s"} in {d.city}
                      </li>
                      {itinerary.hotels
                        .filter((h) => h.city === d.city && h.hotelName)
                        .map((h) => (
                          <li key={h.id}>{h.hotelName}</li>
                        ))}
                      {itinerary.transfers
                        .filter((t) => t.city === d.city)
                        .map((t) => (
                          <li key={t.id}>{t.title}</li>
                        ))}
                      {!itinerary.hotels.some((h) => h.city === d.city && h.hotelName) && (
                        <li className="text-red-600">Stay information is missing</li>
                      )}
                    </ul>
                  </div>
                ))}
            </div>
          </aside>
        </div>
      )}

      {/* Trip details dialog */}
      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Change Trip Details</DialogTitle>
          </DialogHeader>

          <div className="space-y-6">
            <section className="space-y-3">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                Destinations
              </h3>
              <p className="text-sm text-muted-foreground">
                Enter cities in the order they will be visited:
              </p>
              {itinerary.destinations.map((dest, index) => (
                <div key={dest.id} className="flex flex-wrap items-end gap-2">
                  <div className="min-w-[200px] flex-1">
                    <Label>City</Label>
                    <CityAutocomplete
                      value={dest.city}
                      onChange={(city) => updateDestination(index, { city })}
                    />
                  </div>
                  <div className="w-32">
                    <Label>Nights</Label>
                    <Select
                      value={String(dest.nights)}
                      onValueChange={(v) => updateDestination(index, { nights: Number(v) })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Array.from({ length: 14 }, (_, i) => i + 1).map((n) => (
                          <SelectItem key={n} value={String(n)}>
                            {n} night{n === 1 ? "" : "s"}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    disabled={itinerary.destinations.length <= 1}
                    onClick={() =>
                      setItinerary((prev) => ({
                        ...prev,
                        destinations: prev.destinations.filter((_, i) => i !== index),
                      }))
                    }
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              <Button
                type="button"
                variant="link"
                className="px-0"
                onClick={() =>
                  setItinerary((prev) => ({
                    ...prev,
                    destinations: [...prev.destinations, { id: newId(), city: "", nights: 2 }],
                  }))
                }
              >
                + Add Another City
              </Button>
            </section>

            <section className="grid gap-3 sm:grid-cols-2">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground sm:col-span-2">
                Trip details
              </h3>
              <div>
                <Label>Leaving From *</Label>
                <CityAutocomplete
                  value={itinerary.leavingFrom}
                  onChange={(leavingFrom) => setItinerary((prev) => ({ ...prev, leavingFrom }))}
                />
              </div>
              <div>
                <Label>Nationality *</Label>
                <Input
                  value={itinerary.nationality}
                  onChange={(e) => setItinerary((prev) => ({ ...prev, nationality: e.target.value }))}
                />
              </div>
              <div>
                <Label>Leaving on *</Label>
                <Input type="date" value={travelDate} onChange={(e) => setTravelDate(e.target.value)} />
              </div>
              <div>
                <Label>Rooms</Label>
                <Input
                  type="number"
                  min={1}
                  value={itinerary.roomCount}
                  onChange={(e) =>
                    setItinerary((prev) => ({ ...prev, roomCount: Number(e.target.value) || 1 }))
                  }
                />
              </div>
              <div>
                <Label>Adults *</Label>
                <Input
                  type="number"
                  min={1}
                  value={adultCount}
                  onChange={(e) => setAdultCount(Number(e.target.value) || 1)}
                />
              </div>
              <div>
                <Label>Children</Label>
                <Input
                  type="number"
                  min={0}
                  value={childCount}
                  onChange={(e) => setChildCount(Number(e.target.value) || 0)}
                />
              </div>
              <div className="sm:col-span-2">
                <Label>Proposal / trip name</Label>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} />
              </div>
            </section>
          </div>

          <DialogFooter>
            {step === "customize" && (
              <Button variant="outline" onClick={() => setDetailsOpen(false)}>
                Cancel
              </Button>
            )}
            <Button onClick={applyDetailsAndContinue}>Continue to customize</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Activity picker */}
      <Dialog open={Boolean(activityPicker)} onOpenChange={(o) => !o && setActivityPicker(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>
              Add activity — {activityPicker?.city} · {activityPicker?.timeOfDay.toLowerCase()}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <p className="mb-2 text-sm font-medium">From catalog</p>
              {catalog.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No catalog activities for this city. Create some under{" "}
                  <Link href="/activities" className="text-primary underline">
                    Activities
                  </Link>{" "}
                  or enter manually below.
                </p>
              ) : (
                <div className="space-y-2">
                  {catalog.map((act) => (
                    <button
                      key={act.id}
                      type="button"
                      className="flex w-full items-start justify-between gap-3 rounded-lg border p-3 text-left hover:bg-muted/40"
                      onClick={() => addActivityFromCatalog(act)}
                    >
                      <div>
                        <p className="font-medium">{act.name}</p>
                        {act.tag && <Badge variant="secondary" className="mt-1">{act.tag}</Badge>}
                        {(act.startTimes || act.duration) && (
                          <p className="mt-1 text-xs text-muted-foreground">
                            {act.startTimes ? `Starts: ${act.startTimes}` : ""}
                            {act.startTimes && act.duration ? " · " : ""}
                            {act.duration ? `Duration: ${act.duration}` : ""}
                          </p>
                        )}
                        {act.description && (
                          <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{act.description}</p>
                        )}
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold">+ {formatCurrency(Number(act.sellPrice))}</p>
                        <Badge className="mt-2">Select</Badge>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="space-y-2 border-t pt-4">
              <p className="text-sm font-medium">Or enter manually</p>
              <Input
                placeholder="Activity name"
                value={manualActivity.title}
                onChange={(e) => setManualActivity((m) => ({ ...m, title: e.target.value }))}
              />
              <Input
                type="number"
                placeholder="Add-on price"
                value={manualActivity.sellPrice}
                onChange={(e) => setManualActivity((m) => ({ ...m, sellPrice: e.target.value }))}
              />
              <Textarea
                rows={2}
                placeholder="Description"
                value={manualActivity.description}
                onChange={(e) => setManualActivity((m) => ({ ...m, description: e.target.value }))}
              />
              <Button onClick={addManualActivity}>Add manual activity</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function NavIcon({
  active,
  label,
  onClick,
  children,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      title={label}
      onClick={onClick}
      className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full border transition-colors ${
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-card text-muted-foreground hover:bg-muted"
      }`}
    >
      {children}
    </button>
  );
}
