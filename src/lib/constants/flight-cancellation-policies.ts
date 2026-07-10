export interface FlightCancellationPolicyOption {
  id: string;
  label: string;
  text: string;
}

/** Pre-written flight cancellation policies - full text is saved on the booking and printed on the voucher. */
export const FLIGHT_CANCELLATION_POLICIES: FlightCancellationPolicyOption[] = [
  {
    id: "airline_standard",
    label: "Standard - As per airline policy",
    text: "Cancellations and date changes are subject to the fare rules of the operating airline. Airline cancellation charges, if any, will apply based on time remaining before scheduled departure. Agency service fees are non-refundable. Approved refunds will be processed within 7–10 working days after airline confirmation.",
  },
  {
    id: "refundable_24h_plus",
    label: "Refundable - 24+ hours before departure",
    text: "• More than 24 hours before scheduled departure: airline cancellation charges plus agency service fee (non-refundable) apply; remaining amount refundable within 7–10 working days.\n• Within 24 hours of scheduled departure: higher airline charges apply as per fare rules.\n• Less than 4 hours before departure or no-show: no refund.",
  },
  {
    id: "tiered_domestic",
    label: "Tiered charges (24h / 4–24h / under 4h)",
    text: "Cancellation charges based on time before scheduled departure:\n• 24 hours or more: 25% of base fare and applicable taxes forfeited; balance refundable.\n• Between 4 hours and 24 hours: 50% of base fare and applicable taxes forfeited.\n• Less than 4 hours or no-show: no refund.\nAgency service charge is non-refundable in all cases. Refunds are processed within 7–14 working days after airline approval.",
  },
  {
    id: "non_refundable",
    label: "Non-refundable / non-changeable fare",
    text: "This booking is on a non-refundable and non-changeable fare as per airline rules. No refund on cancellation. Date change or rebooking, if permitted by the airline, may attract fare difference, airline penalties, and agency service fees.",
  },
  {
    id: "flexible_24h",
    label: "Free cancellation up to 24 hours before departure",
    text: "Free cancellation permitted up to 24 hours before scheduled departure time; full refund minus payment gateway or bank charges, if any. Cancellations made within 24 hours of scheduled departure are subject to airline cancellation fees and agency service charges as applicable.",
  },
  {
    id: "indigo_style",
    label: "Domestic - airline slab (2h / 2–24h / 24h+)",
    text: "Cancellation charges as per airline policy apply based on time before scheduled departure:\n• More than 24 hours: lower cancellation fee as per airline fare rules.\n• Between 2 hours and 24 hours: higher cancellation fee applies.\n• Less than 2 hours before departure or no-show: no refund.\nAgency service fee is non-refundable. Refund processing time: 7–14 working days from airline confirmation.",
  },
  {
    id: "partial_credit",
    label: "Airline credit / open ticket (no cash refund)",
    text: "On cancellation, value may be retained as airline credit or open ticket subject to airline fare rules and validity period. No cash refund. Credit must be used within the validity period mentioned by the airline. Agency service fees are non-refundable.",
  },
];

export const FLIGHT_CANCELLATION_CUSTOM_ID = "custom";

export function findFlightCancellationPolicyByText(text?: string | null) {
  const normalized = text?.trim();
  if (!normalized) return null;
  return FLIGHT_CANCELLATION_POLICIES.find((p) => p.text === normalized) ?? null;
}

export function resolveFlightCancellationPresetId(text?: string | null) {
  const match = findFlightCancellationPolicyByText(text);
  return match?.id ?? (text?.trim() ? FLIGHT_CANCELLATION_CUSTOM_ID : "");
}
