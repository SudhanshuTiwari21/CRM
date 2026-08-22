"use client";

import Link from "next/link";
import { formatDateTime } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CalendarClock, AlertTriangle } from "lucide-react";

interface FollowUpLeadRow {
  id: string;
  queryRef: string | null;
  name: string;
  phone: string | null;
  nextFollowUpAt: Date | string | null;
  assignedAgent: { name: string } | null;
}

function LeadFollowUpList({
  title,
  items,
  emptyLabel,
  tone,
}: {
  title: string;
  items: FollowUpLeadRow[];
  emptyLabel: string;
  tone?: "danger" | "warning";
}) {
  return (
    <div>
      <p
        className={
          tone === "danger"
            ? "mb-2 text-xs font-semibold uppercase tracking-wide text-red-600"
            : tone === "warning"
              ? "mb-2 text-xs font-semibold uppercase tracking-wide text-amber-600"
              : "mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground"
        }
      >
        {title}
      </p>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">{emptyLabel}</p>
      ) : (
        <ul className="space-y-2">
          {items.map((lead) => (
            <li key={lead.id} className="rounded-md border px-3 py-2 text-sm">
              <Link href={`/leads/${lead.id}`} className="font-medium text-primary hover:underline">
                {lead.name}
              </Link>
              <p className="text-xs text-muted-foreground">
                {[lead.queryRef, lead.assignedAgent?.name].filter(Boolean).join(" · ")}
              </p>
              {lead.nextFollowUpAt && (
                <p className="text-xs text-muted-foreground">
                  {formatDateTime(
                    typeof lead.nextFollowUpAt === "string"
                      ? lead.nextFollowUpAt
                      : lead.nextFollowUpAt.toISOString()
                  )}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function LeadFollowUpsPanel({
  overdue,
  dueToday,
  overdueCount,
  dueTodayCount,
}: {
  overdue: FollowUpLeadRow[];
  dueToday: FollowUpLeadRow[];
  overdueCount: number;
  dueTodayCount: number;
}) {
  return (
    <Card className="h-full">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle className="text-base font-semibold">Lead follow-ups</CardTitle>
        <Button variant="outline" size="sm" asChild>
          <Link href="/leads">View all</Link>
        </Button>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2">
            <div className="flex items-center gap-1.5 text-red-700">
              <AlertTriangle className="h-4 w-4" />
              <span className="text-xs font-medium">Overdue</span>
            </div>
            <p className="text-2xl font-bold text-red-800">{overdueCount}</p>
          </div>
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
            <div className="flex items-center gap-1.5 text-amber-700">
              <CalendarClock className="h-4 w-4" />
              <span className="text-xs font-medium">Due today</span>
            </div>
            <p className="text-2xl font-bold text-amber-800">{dueTodayCount}</p>
          </div>
        </div>
        <LeadFollowUpList
          title="Overdue"
          items={overdue}
          emptyLabel="No overdue follow-ups"
          tone="danger"
        />
        <LeadFollowUpList
          title="Due today"
          items={dueToday}
          emptyLabel="Nothing scheduled for today"
          tone="warning"
        />
      </CardContent>
    </Card>
  );
}
