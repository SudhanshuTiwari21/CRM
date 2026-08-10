import type { LeadSource, LeadStatus } from "@prisma/client";

export const LEAD_STATUS_LABELS: Record<LeadStatus, string> = {
  NEW: "New",
  CONTACTED: "Contacted",
  QUALIFIED: "Qualified",
  PROPOSAL: "Proposal",
  WON: "Won",
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

export const LEAD_STATUS_OPTIONS = (Object.keys(LEAD_STATUS_LABELS) as LeadStatus[]).map(
  (value) => ({ value, label: LEAD_STATUS_LABELS[value] })
);

export const LEAD_SOURCE_OPTIONS = (Object.keys(LEAD_SOURCE_LABELS) as LeadSource[]).map(
  (value) => ({ value, label: LEAD_SOURCE_LABELS[value] })
);

export const LEAD_PRODUCT_OPTIONS = [
  { value: "FLIGHT", label: "Flight" },
  { value: "HOTEL", label: "Hotel" },
  { value: "BUS", label: "Bus" },
] as const;
