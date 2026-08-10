import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LeadStatusBadge } from "@/components/leads/lead-status-badge";
import { LeadNotesPanel } from "@/components/leads/lead-notes-panel";
import { LeadDetailActions } from "@/components/leads/lead-detail-actions";
import { getLeadById } from "@/lib/services/lead.service";
import { LEAD_SOURCE_LABELS } from "@/lib/constants/lead";
import { formatCurrency, formatDateTime } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function LeadDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const lead = await getLeadById(id);
  if (!lead) notFound();

  return (
    <div>
      <div className="mb-4">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/leads">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to leads
          </Link>
        </Button>
      </div>

      <Header
        title={lead.name}
        description={[
          lead.phone,
          lead.company,
          LEAD_SOURCE_LABELS[lead.source],
          lead.productInterest,
        ]
          .filter(Boolean)
          .join(" · ")}
        actions={<LeadStatusBadge status={lead.status} />}
      />

      <div className="mb-6 grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Estimated value</CardTitle>
          </CardHeader>
          <CardContent className="text-xl font-semibold">
            {lead.estimatedValue != null ? formatCurrency(Number(lead.estimatedValue)) : "—"}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Next follow-up</CardTitle>
          </CardHeader>
          <CardContent className="text-xl font-semibold">
            {lead.nextFollowUpAt ? formatDateTime(lead.nextFollowUpAt) : "—"}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Assignee</CardTitle>
          </CardHeader>
          <CardContent className="text-xl font-semibold">
            {lead.assignedAgent?.name || "Unassigned"}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <LeadDetailActions
            lead={{
              id: lead.id,
              name: lead.name,
              phone: lead.phone,
              email: lead.email,
              company: lead.company,
              source: lead.source,
              status: lead.status,
              productInterest: lead.productInterest,
              estimatedValue: lead.estimatedValue != null ? Number(lead.estimatedValue) : null,
              nextFollowUpAt: lead.nextFollowUpAt?.toISOString() || null,
              lostReason: lead.lostReason,
              requirement: lead.requirement,
              assignedAgentId: lead.assignedAgentId,
              customerId: lead.customerId,
              customer: lead.customer,
            }}
          />
        </div>
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Activity</CardTitle>
            </CardHeader>
            <CardContent>
              <LeadNotesPanel
                leadId={lead.id}
                notes={lead.notes.map((n) => ({
                  id: n.id,
                  type: n.type,
                  body: n.body,
                  createdAt: n.createdAt.toISOString(),
                  user: n.user,
                }))}
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
