"use client";

import { Badge } from "@/components/ui/badge";
import { LEAD_STATUS_LABELS, LEAD_STATUS_VARIANT } from "@/lib/constants/lead";
import type { LeadStatus } from "@prisma/client";

export function LeadStatusBadge({ status }: { status: LeadStatus }) {
  return <Badge variant={LEAD_STATUS_VARIANT[status]}>{LEAD_STATUS_LABELS[status]}</Badge>;
}
