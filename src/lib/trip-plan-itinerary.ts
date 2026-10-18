export type DestinationStop = {
  id: string;
  city: string;
  nights: number;
};

export type TimeOfDay = "MORNING" | "AFTERNOON" | "EVENING";

export type NexusFlightLeg = {
  id: string;
  title: string;
  description: string;
  costPrice: number;
  sellPrice: number;
};

export type NexusHotelStay = {
  id: string;
  city: string;
  stayType: string;
  hotelName: string;
  description: string;
  costPrice: number;
  sellPrice: number;
};

export type NexusTransfer = {
  id: string;
  city: string;
  title: string;
  details: string;
  costPrice: number;
  sellPrice: number;
};

export type NexusDayActivity = {
  id: string;
  city: string;
  dayNumber: number;
  timeOfDay: TimeOfDay;
  title: string;
  description: string;
  tag: string;
  startTimes: string;
  duration: string;
  activityId?: string;
  costPrice: number;
  sellPrice: number;
};

export type NexusItineraryState = {
  leavingFrom: string;
  nationality: string;
  roomCount: number;
  destinations: DestinationStop[];
  flights: NexusFlightLeg[];
  hotels: NexusHotelStay[];
  transfers: NexusTransfer[];
  activities: NexusDayActivity[];
};

export function newId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `id_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export function totalNights(destinations: DestinationStop[]) {
  return destinations.reduce((sum, d) => sum + Math.max(0, d.nights || 0), 0);
}

export function destinationsLabel(destinations: DestinationStop[]) {
  return destinations.map((d) => d.city).filter(Boolean).join(", ");
}

export function emptyNexusItinerary(partial?: Partial<NexusItineraryState>): NexusItineraryState {
  return {
    leavingFrom: partial?.leavingFrom || "",
    nationality: partial?.nationality || "India",
    roomCount: partial?.roomCount ?? 1,
    destinations: partial?.destinations?.length
      ? partial.destinations
      : [{ id: newId(), city: "", nights: 2 }],
    flights: partial?.flights || [],
    hotels: partial?.hotels || [],
    transfers: partial?.transfers || [],
    activities: partial?.activities || [],
  };
}

export function parseDestinationsFromString(raw?: string | null): DestinationStop[] {
  if (!raw?.trim()) return [{ id: newId(), city: "", nights: 2 }];
  return raw
    .split(/[,/|]/)
    .map((part) => part.trim())
    .filter(Boolean)
    .map((city) => ({ id: newId(), city, nights: 2 }));
}

export function parseNexusItinerary(raw: unknown, fallbackDestinations?: string | null): NexusItineraryState {
  if (raw && typeof raw === "object") {
    const obj = raw as Partial<NexusItineraryState>;
    return emptyNexusItinerary({
      leavingFrom: obj.leavingFrom || "",
      nationality: obj.nationality || "India",
      roomCount: obj.roomCount ?? 1,
      destinations:
        Array.isArray(obj.destinations) && obj.destinations.length
          ? obj.destinations.map((d) => ({
              id: d.id || newId(),
              city: d.city || "",
              nights: Math.max(1, Number(d.nights) || 1),
            }))
          : parseDestinationsFromString(fallbackDestinations),
      flights: Array.isArray(obj.flights) ? obj.flights : [],
      hotels: Array.isArray(obj.hotels) ? obj.hotels : [],
      transfers: Array.isArray(obj.transfers) ? obj.transfers : [],
      activities: Array.isArray(obj.activities) ? obj.activities : [],
    });
  }
  return emptyNexusItinerary({
    destinations: parseDestinationsFromString(fallbackDestinations),
  });
}

/** Expand destination nights into sequential day numbers per city */
export function buildCityDayMap(destinations: DestinationStop[]) {
  const days: { dayNumber: number; city: string }[] = [];
  let day = 1;
  for (const dest of destinations) {
    if (!dest.city.trim()) continue;
    const nights = Math.max(1, dest.nights || 1);
    for (let i = 0; i < nights; i++) {
      days.push({ dayNumber: day, city: dest.city.trim() });
      day += 1;
    }
  }
  // Arrival day in last city after last night stretch: keep last city for checkout day
  if (days.length) {
    days.push({ dayNumber: day, city: days[days.length - 1].city });
  }
  return days;
}
