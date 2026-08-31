import { notFound } from "next/navigation";
import { getLeadById } from "@/lib/services/lead.service";
import { getTripPlanById } from "@/lib/services/trip-plan.service";
import { TripPlanBuilder, type TripPlanFormState, type TripPlanItemForm } from "@/components/trip-plan/trip-plan-builder";

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

  const initialPlan: TripPlanFormState = {
    id: plan.id,
    leadId: plan.leadId,
    version: plan.version,
    status: plan.status,
    title: plan.title,
    travelDate: toDateInput(plan.travelDate),
    returnDate: toDateInput(plan.returnDate),
    destinations: plan.destinations || "",
    adultCount: plan.adultCount != null ? String(plan.adultCount) : "",
    childCount: plan.childCount != null ? String(plan.childCount) : "",
    infantCount: plan.infantCount != null ? String(plan.infantCount) : "",
    durationDays: plan.durationDays != null ? String(plan.durationDays) : "",
    currency: plan.currency,
    gstRate: plan.gstRate != null ? String(plan.gstRate) : "",
    offerPrice: String(Number(plan.offerPrice)),
    inclusions: plan.inclusions || "",
    exclusions: plan.exclusions || "",
    terms: plan.terms || "",
    internalNotes: plan.internalNotes || "",
    items: plan.items.map(
      (item): TripPlanItemForm => ({
        id: item.id,
        dayNumber: item.dayNumber,
        sortOrder: item.sortOrder,
        serviceType: item.serviceType,
        title: item.title,
        description: item.description || "",
        supplierName: item.supplierName || "",
        location: item.location || "",
        serviceDate: toDateInput(item.serviceDate),
        quantity: item.quantity,
        costPrice: Number(item.costPrice),
        markupType: item.markupType,
        markupValue: Number(item.markupValue),
        sellPrice: Number(item.sellPrice),
      })
    ),
  };

  return (
    <TripPlanBuilder
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
      initialPlan={initialPlan}
    />
  );
}
