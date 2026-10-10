import type { LeadSource, LeadStatus, LeadTemperature, LeadServiceType, LeadCustomerSegment } from "@prisma/client";

export const LEAD_STATUS_LABELS: Record<LeadStatus, string> = {
  NEW: "New",
  CONTACTED: "Contacted",
  QUALIFIED: "Qualified",
  PROPOSAL: "Proposal Sent",
  WON: "Converted",
  LOST: "Lost",
};

export const LEAD_STATUS_VARIANT: Record<
  LeadStatus,
  "default" | "secondary" | "success" | "warning" | "destructive" | "info" | "outline"
> = {
  NEW: "info",
  CONTACTED: "secondary",
  QUALIFIED: "warning",
  PROPOSAL: "default",
  WON: "success",
  LOST: "destructive",
};

export const LEAD_SOURCE_LABELS: Record<LeadSource, string> = {
  PHONE: "Phone",
  WHATSAPP: "WhatsApp",
  EMAIL: "Email",
  WALK_IN: "Walk-in",
  REFERRAL: "Referral",
  WEBSITE: "Website",
  OTHER: "Other",
};

export const LEAD_TEMPERATURE_LABELS: Record<LeadTemperature, string> = {
  HOT: "Hot",
  WARM: "Warm",
  COLD: "Cold",
  NONE: "No Status",
};

export const LEAD_TEMPERATURE_COLORS: Record<LeadTemperature, string> = {
  HOT: "border-red-500 text-red-600",
  WARM: "border-amber-500 text-amber-600",
  COLD: "border-blue-500 text-blue-600",
  NONE: "border-slate-400 text-slate-600",
};

export const LEAD_TEMPERATURE_ACTIVE: Record<LeadTemperature, string> = {
  HOT: "border-red-500 bg-red-50 text-red-700",
  WARM: "border-amber-500 bg-amber-50 text-amber-700",
  COLD: "border-blue-500 bg-blue-50 text-blue-700",
  NONE: "border-slate-500 bg-slate-100 text-slate-800",
};

export const LEAD_SERVICE_TYPE_LABELS: Record<LeadServiceType, string> = {
  PACKAGE: "Package",
  FLIGHT: "Flight",
  HOTEL: "Hotel",
  VISA: "Visa",
  BUS: "Bus",
  OTHER: "Other",
};

export const LEAD_CUSTOMER_SEGMENT_LABELS: Record<LeadCustomerSegment, string> = {
  B2C: "B2C",
  B2B: "B2B",
};

export type LeadProgressFilter =
  | "IN_PROGRESS"
  | "RECENT"
  | "CONFIRMED"
  | "CONVERTED"
  | "LOST"
  | "OVERALL";

export const LEAD_PROGRESS_OPTIONS: { value: LeadProgressFilter; label: string }[] = [
  { value: "IN_PROGRESS", label: "In Progress" },
  { value: "RECENT", label: "Recent" },
  { value: "CONFIRMED", label: "Confirmed" },
  { value: "CONVERTED", label: "Converted" },
  { value: "LOST", label: "Lost / Trash" },
  { value: "OVERALL", label: "Overall" },
];

export const LEAD_STATUS_OPTIONS = (Object.keys(LEAD_STATUS_LABELS) as LeadStatus[]).map(
  (value) => ({ value, label: LEAD_STATUS_LABELS[value] })
);

export const LEAD_SOURCE_OPTIONS = (Object.keys(LEAD_SOURCE_LABELS) as LeadSource[]).map(
  (value) => ({ value, label: LEAD_SOURCE_LABELS[value] })
);

export const LEAD_TEMPERATURE_OPTIONS = (
  Object.keys(LEAD_TEMPERATURE_LABELS) as LeadTemperature[]
).map((value) => ({ value, label: LEAD_TEMPERATURE_LABELS[value] }));

export const LEAD_SERVICE_TYPE_OPTIONS = (
  Object.keys(LEAD_SERVICE_TYPE_LABELS) as LeadServiceType[]
).map((value) => ({ value, label: LEAD_SERVICE_TYPE_LABELS[value] }));

export const LEAD_CUSTOMER_SEGMENT_OPTIONS = (
  Object.keys(LEAD_CUSTOMER_SEGMENT_LABELS) as LeadCustomerSegment[]
).map((value) => ({ value, label: LEAD_CUSTOMER_SEGMENT_LABELS[value] }));

export const LEAD_CALL_OUTCOME_LABELS: Record<
  import("@prisma/client").LeadCallOutcome,
  string
> = {
  ANSWERED: "Answered",
  UNANSWERED: "Unanswered",
  NOT_REACHABLE: "Not Reachable",
  CALLBACK: "Call Back",
  LOST: "Lost",
};

export const LEAD_CALL_DIRECTION_LABELS: Record<
  import("@prisma/client").LeadCallDirection,
  string
> = {
  INCOMING: "Incoming",
  OUTGOING: "Outgoing",
};

export const LEAD_TASK_TYPE_LABELS: Record<import("@prisma/client").LeadTaskType, string> = {
  CALL: "Call",
  TODO: "To Do",
};

export const LEAD_QUICK_SCHEDULE_OPTIONS = [
  { id: "today", label: "Today", days: 0 },
  { id: "tomorrow", label: "Tomorrow", days: 1 },
  { id: "in2", label: "In 2 days", days: 2 },
  { id: "in3", label: "In 3 days", days: 3 },
  { id: "custom", label: "Custom", days: null },
] as const;

export const LEAD_PRODUCT_OPTIONS = [
  { value: "PACKAGE", label: "Package" },
  { value: "FLIGHT", label: "Flight" },
  { value: "HOTEL", label: "Hotel" },
  { value: "BUS", label: "Bus" },
  { value: "VISA", label: "Visa" },
  { value: "OTHER", label: "Other" },
] as const;

export function formatLeadPax(adultCount?: number | null, childCount?: number | null, infantCount?: number | null) {
  const parts: string[] = [];
  if (adultCount && adultCount > 0) parts.push(`${adultCount} Adult${adultCount > 1 ? "s" : ""}`);
  if (childCount && childCount > 0) parts.push(`${childCount} Child${childCount > 1 ? "ren" : ""}`);
  if (infantCount && infantCount > 0) parts.push(`${infantCount} Infant${infantCount > 1 ? "s" : ""}`);
  return parts.length > 0 ? parts.join(", ") : "—";
}

export function getServiceDescription(serviceType?: LeadServiceType | null, requirement?: string | null) {
  if (requirement?.trim()) return requirement.trim();
  if (serviceType) return `${LEAD_SERVICE_TYPE_LABELS[serviceType]} enquiry`;
  return "—";
}
