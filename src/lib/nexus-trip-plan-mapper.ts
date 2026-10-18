import type { TripServiceType, TripMarkupType } from "@prisma/client";
import {
  buildCityDayMap,
  destinationsLabel,
  totalNights,
  type NexusItineraryState,
} from "@/lib/trip-plan-itinerary";

export type MappedTripPlanItem = {
  dayNumber: number;
  sortOrder: number;
  serviceType: TripServiceType;
  title: string;
  description?: string | null;
  supplierName?: string | null;
  location?: string | null;
  quantity: number;
  costPrice: number;
  markupType: TripMarkupType;
  markupValue: number;
  sellPrice: number;
  metadata?: Record<string, unknown> | null;
};

export function mapNexusToTripPlanPayload(params: {
  title: string;
  travelDate: string;
  adultCount: number;
  childCount: number;
  infantCount: number;
  offerPrice?: number;
  inclusions?: string;
  exclusions?: string;
  terms?: string;
  internalNotes?: string;
  itinerary: NexusItineraryState;
}) {
  const { itinerary } = params;
  const nights = totalNights(itinerary.destinations);
  const durationDays = Math.max(1, nights + 1);
  const items: MappedTripPlanItem[] = [];
  let sortOrder = 0;

  for (const flight of itinerary.flights) {
    if (!flight.title.trim()) continue;
    items.push({
      dayNumber: 1,
      sortOrder: sortOrder++,
      serviceType: "FLIGHT",
      title: flight.title.trim(),
      description: flight.description || null,
      location: itinerary.leavingFrom || null,
      quantity: 1,
      costPrice: flight.costPrice || 0,
      markupType: "FIXED",
      markupValue: Math.max(0, (flight.sellPrice || 0) - (flight.costPrice || 0)),
      sellPrice: flight.sellPrice || flight.costPrice || 0,
      metadata: { nexusType: "flight", id: flight.id },
    });
  }

  for (const hotel of itinerary.hotels) {
    if (!hotel.hotelName.trim() && !hotel.city.trim()) continue;
    const cityDays = buildCityDayMap(itinerary.destinations);
    const dayNumber = cityDays.find((d) => d.city === hotel.city)?.dayNumber || 1;
    items.push({
      dayNumber,
      sortOrder: sortOrder++,
      serviceType: "HOTEL",
      title: hotel.hotelName.trim() || `Stay in ${hotel.city}`,
      description: [hotel.stayType, hotel.description].filter(Boolean).join(" — ") || null,
      location: hotel.city || null,
      quantity: 1,
      costPrice: hotel.costPrice || 0,
      markupType: "FIXED",
      markupValue: Math.max(0, (hotel.sellPrice || 0) - (hotel.costPrice || 0)),
      sellPrice: hotel.sellPrice || hotel.costPrice || 0,
      metadata: {
        nexusType: "hotel",
        id: hotel.id,
        stayType: hotel.stayType,
        city: hotel.city,
      },
    });
  }

  for (const transfer of itinerary.transfers) {
    if (!transfer.title.trim()) continue;
    const cityDays = buildCityDayMap(itinerary.destinations);
    const dayNumber = cityDays.find((d) => d.city === transfer.city)?.dayNumber || 1;
    items.push({
      dayNumber,
      sortOrder: sortOrder++,
      serviceType: "TRANSFER",
      title: transfer.title.trim(),
      description: transfer.details || null,
      location: transfer.city || null,
      quantity: 1,
      costPrice: transfer.costPrice || 0,
      markupType: "FIXED",
      markupValue: Math.max(0, (transfer.sellPrice || 0) - (transfer.costPrice || 0)),
      sellPrice: transfer.sellPrice || transfer.costPrice || 0,
      metadata: { nexusType: "transfer", id: transfer.id, city: transfer.city },
    });
  }

  for (const activity of itinerary.activities) {
    if (!activity.title.trim()) continue;
    items.push({
      dayNumber: activity.dayNumber || 1,
      sortOrder: sortOrder++,
      serviceType: "SIGHTSEEING",
      title: activity.title.trim(),
      description: activity.description || null,
      location: activity.city || null,
      quantity: 1,
      costPrice: activity.costPrice || 0,
      markupType: "FIXED",
      markupValue: Math.max(0, (activity.sellPrice || 0) - (activity.costPrice || 0)),
      sellPrice: activity.sellPrice || activity.costPrice || 0,
      metadata: {
        nexusType: "activity",
        id: activity.id,
        city: activity.city,
        timeOfDay: activity.timeOfDay,
        activityId: activity.activityId,
        tag: activity.tag,
        startTimes: activity.startTimes,
        duration: activity.duration,
      },
    });
  }

  const subtotalSell = items.reduce((s, i) => s + (i.sellPrice || 0), 0);
  let returnDate = "";
  if (params.travelDate) {
    const d = new Date(params.travelDate);
    if (!Number.isNaN(d.getTime())) {
      d.setDate(d.getDate() + nights);
      const pad = (n: number) => String(n).padStart(2, "0");
      returnDate = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    }
  }

  return {
    title: params.title.trim(),
    travelDate: params.travelDate || null,
    returnDate: returnDate || null,
    destinations: destinationsLabel(itinerary.destinations) || null,
    leavingFrom: itinerary.leavingFrom || null,
    nationality: itinerary.nationality || null,
    roomCount: itinerary.roomCount || 1,
    adultCount: params.adultCount,
    childCount: params.childCount,
    infantCount: params.infantCount,
    durationDays,
    currency: "INR",
    offerPrice: params.offerPrice != null ? params.offerPrice : subtotalSell,
    inclusions: params.inclusions || null,
    exclusions: params.exclusions || null,
    terms: params.terms || null,
    internalNotes: params.internalNotes || null,
    itineraryJson: itinerary,
    items,
  };
}

export function computeNexusTotals(itinerary: NexusItineraryState) {
  const lines = [
    ...itinerary.flights,
    ...itinerary.hotels,
    ...itinerary.transfers,
    ...itinerary.activities,
  ];
  const cost = lines.reduce((s, l) => s + (Number(l.costPrice) || 0), 0);
  const sell = lines.reduce((s, l) => s + (Number(l.sellPrice) || 0), 0);
  return { cost, sell };
}
