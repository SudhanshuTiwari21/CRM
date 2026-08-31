"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, Map, Plus, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TRIP_PLAN_STATUS_LABELS } from "@/lib/constants/trip-plan";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import type { TripPlanStatus } from "@prisma/client";

interface TripPlanSummary {
  id: string;
  version: number;
  title: string;
  status: TripPlanStatus;
  offerPrice: string | number;
  currency: string;
  createdAt: string;
  sentAt?: string | null;
  createdBy?: { name: string } | null;
  _count?: { items: number };
}

export function LeadTripPlansPanel({ leadId }: { leadId: string }) {
  const router = useRouter();
  const [plans, setPlans] = useState<TripPlanSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/crm/leads/${leadId}/trip-plans`)
      .then((r) => r.json())
      .then((data) => setPlans(Array.isArray(data) ? data : data?.data || []))
      .catch(() => setPlans([]))
      .finally(() => setLoading(false));
  }, [leadId]);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2 text-base">
          <Map className="h-4 w-4" />
          Trip plans & proposals
        </CardTitle>
        <Button size="sm" asChild>
          <Link href={`/leads/${leadId}/trip-plan/new`}>
            <Plus className="mr-2 h-4 w-4" />
            Create trip plan
          </Link>
        </Button>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : plans.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No trip plans yet. Build a multi-service itinerary with hotels, transfers, sightseeing,
            visa and more — then send a PDF proposal to the customer.
          </p>
        ) : (
          <div className="space-y-3">
            {plans.map((plan) => (
              <div
                key={plan.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{plan.title}</span>
                    <Badge variant="outline">V{plan.version}</Badge>
                    <Badge variant="secondary">{TRIP_PLAN_STATUS_LABELS[plan.status]}</Badge>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {formatCurrency(Number(plan.offerPrice))}
                    {plan._count ? ` · ${plan._count.items} services` : ""}
                    {plan.sentAt ? ` · Sent ${formatDateTime(plan.sentAt)}` : ""}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" asChild>
                    <a href={`/api/crm/trip-plans/${plan.id}/pdf`} target="_blank" rel="noreferrer">
                      <FileText className="mr-1 h-3 w-3" />
                      PDF
                    </a>
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => router.push(`/leads/${leadId}/trip-plan/${plan.id}`)}
                  >
                    Open
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
