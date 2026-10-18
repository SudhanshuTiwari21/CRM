import { notFound } from "next/navigation";
import { getLeadById } from "@/lib/services/lead.service";
import { getTripPlanById } from "@/lib/services/trip-plan.service";
import { NexusTripPlanBuilder } from "@/components/trip-plan/nexus-trip-plan-builder";

export const dynamic = "force-dynamic";

function toDateInput(value?: Date | null) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export default async function EditTripPlanPage({
  params,
}: {
  params: Promise<{ id: string; planId: string }>;
}) {
  const { id, planId } = await params;
  const lead = await getLeadById(id);
  if (!lead) notFound();

  const plan = await getTripPlanById(planId);
  if (!plan || plan.leadId !== lead.id) notFound();

  return (
    <NexusTripPlanBuilder
      leadId={lead.id}
      lead={{
        id: lead.id,
        name: lead.name,
        queryRef: lead.queryRef,
        destinations: lead.destinations,
        travelDate: lead.travelDate,
        returnDate: lead.returnDate,
        adultCount: lead.adultCount,
        childCount: lead.childCount,
        infantCount: lead.infantCount,
      }}
      initialPlan={{
        id: plan.id,
        version: plan.version,
        status: plan.status,
        title: plan.title,
        travelDate: toDateInput(plan.travelDate),
        adultCount: plan.adultCount != null ? String(plan.adultCount) : "",
        childCount: plan.childCount != null ? String(plan.childCount) : "",
        infantCount: plan.infantCount != null ? String(plan.infantCount) : "",
        offerPrice: String(Number(plan.offerPrice)),
        inclusions: plan.inclusions || "",
        exclusions: plan.exclusions || "",
        terms: plan.terms || "",
        internalNotes: plan.internalNotes || "",
        leavingFrom: plan.leavingFrom,
        nationality: plan.nationality,
        roomCount: plan.roomCount,
        destinations: plan.destinations,
        itineraryJson: plan.itineraryJson,
      }}
    />
  );
}
