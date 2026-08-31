import type { TripPlanStatus, TripServiceType } from "@prisma/client";

export const TRIP_PLAN_STATUS_LABELS: Record<TripPlanStatus, string> = {
  DRAFT: "Draft",
  SENT: "Sent",
  ACCEPTED: "Accepted",
  REJECTED: "Rejected",
  SUPERSEDED: "Superseded",
};

export const TRIP_PLAN_STATUS_OPTIONS = Object.entries(TRIP_PLAN_STATUS_LABELS).map(
  ([value, label]) => ({ value: value as TripPlanStatus, label })
);

export const TRIP_SERVICE_TYPE_LABELS: Record<TripServiceType, string> = {
  FLIGHT: "Flight",
  HOTEL: "Hotel",
  TRANSFER: "Transfer",
  SIGHTSEEING: "Sightseeing",
  VISA: "Visa",
  MEAL: "Meals",
  GUIDE: "Guide",
  INSURANCE: "Insurance",
  BUS: "Bus",
  OTHER: "Other",
};

export const TRIP_SERVICE_TYPE_OPTIONS = Object.entries(TRIP_SERVICE_TYPE_LABELS).map(
  ([value, label]) => ({ value: value as TripServiceType, label })
);

export const TRIP_MARKUP_TYPE_OPTIONS = [
  { value: "FIXED" as const, label: "Fixed (Rs.)" },
  { value: "PERCENT" as const, label: "Percent (%)" },
];

export const DEFAULT_TRIP_TERMS = `• Rates are subject to availability at the time of booking.
• 50% advance required to confirm; balance before travel.
• Cancellation charges as per supplier policy.
• Prices exclude personal expenses, tips, and anything not mentioned in inclusions.`;
