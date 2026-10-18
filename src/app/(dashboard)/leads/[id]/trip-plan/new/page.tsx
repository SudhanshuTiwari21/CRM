import { notFound } from "next/navigation";
import { getLeadById } from "@/lib/services/lead.service";
import { NexusTripPlanBuilder } from "@/components/trip-plan/nexus-trip-plan-builder";

export const dynamic = "force-dynamic";

export default async function NewTripPlanPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const lead = await getLeadById(id);
  if (!lead) notFound();

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
    />
  );
}
