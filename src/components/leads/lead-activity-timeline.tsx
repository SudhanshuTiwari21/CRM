"use client";

import {
  Phone,
  Mail,
  MessageCircle,
  StickyNote,
  GitBranch,
  UserCheck,
  CalendarClock,
  CheckCircle2,
} from "lucide-react";
import { formatDateTime } from "@/lib/utils";
import { cn } from "@/lib/utils";
import {
  LEAD_CALL_OUTCOME_LABELS,
  LEAD_STATUS_LABELS,
  LEAD_TASK_TYPE_LABELS,
  LEAD_TEMPERATURE_LABELS,
} from "@/lib/constants/lead";
import type { LeadCallOutcome, LeadNoteType, LeadTemperature } from "@prisma/client";

interface TimelineNote {
  id: string;
  kind: "note";
  type: LeadNoteType;
  body: string;
  createdAt: string;
  user: { id: string; name: string } | null;
  details?: Record<string, unknown> | null;
}

interface TimelineTask {
  id: string;
  kind: "task";
  type: string;
  direction: string | null;
  outcome: LeadCallOutcome | null;
  scheduledAt: string | null;
  isCompleted: boolean;
  details: string | null;
  temperature: LeadTemperature | null;
  createdAt: string;
  assignedTo: { id: string; name: string } | null;
  createdBy: { id: string; name: string } | null;
}

export type TimelineItem = TimelineNote | TimelineTask;

function noteIcon(type: LeadNoteType) {
  switch (type) {
    case "CALL":
      return Phone;
    case "EMAIL":
      return Mail;
    case "WHATSAPP":
      return MessageCircle;
    case "STATUS_CHANGE":
      return GitBranch;
    case "ASSIGNMENT":
      return UserCheck;
    default:
      return StickyNote;
  }
}

function taskIcon(type: string, isCompleted: boolean) {
  if (isCompleted) return CheckCircle2;
  return type === "CALL" ? Phone : CalendarClock;
}

function renderNoteDetails(note: TimelineNote) {
  const d = note.details;
  if (!d || typeof d !== "object") return null;

  if (note.type === "STATUS_CHANGE" && "fromStatus" in d && "toStatus" in d) {
    return (
      <p className="mt-1 text-xs text-muted-foreground">
        {LEAD_STATUS_LABELS[d.fromStatus as keyof typeof LEAD_STATUS_LABELS]} →{" "}
        {LEAD_STATUS_LABELS[d.toStatus as keyof typeof LEAD_STATUS_LABELS]}
      </p>
    );
  }

  if (note.type === "CALL" && "outcome" in d && d.outcome) {
    return (
      <p className="mt-1 text-xs text-muted-foreground">
        Outcome: {LEAD_CALL_OUTCOME_LABELS[d.outcome as LeadCallOutcome]}
      </p>
    );
  }

  return null;
}

export function LeadActivityTimeline({ items }: { items: TimelineItem[] }) {
  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground">No activity yet</p>;
  }

  return (
    <div className="relative space-y-0">
      <div className="absolute bottom-2 left-[18px] top-2 w-px bg-border" />
      {items.map((item, index) => {
        const isTask = item.kind === "task";
        const Icon = isTask
          ? taskIcon(item.type, item.isCompleted)
          : noteIcon(item.type as LeadNoteType);
        const isAlt = index % 2 === 1;

        const title = isTask
          ? `${LEAD_TASK_TYPE_LABELS[item.type as keyof typeof LEAD_TASK_TYPE_LABELS]}${
              item.isCompleted ? " (Completed)" : " (Scheduled)"
            }`
          : (item.type as string).replace(/_/g, " ");

        const subtitle = isTask
          ? item.createdBy?.name || item.assignedTo?.name || "System"
          : item.user?.name || "System";

        const body = isTask
          ? [
              item.outcome ? LEAD_CALL_OUTCOME_LABELS[item.outcome] : null,
              item.details,
              item.scheduledAt && !item.isCompleted
                ? `Follow up: ${formatDateTime(item.scheduledAt)}`
                : null,
              item.temperature && item.temperature !== "NONE"
                ? LEAD_TEMPERATURE_LABELS[item.temperature]
                : null,
            ]
              .filter(Boolean)
              .join(" · ")
          : item.body;

        return (
          <div key={`${item.kind}-${item.id}`} className="relative flex gap-3 pb-5">
            <div
              className={cn(
                "relative z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 bg-background",
                isTask && item.isCompleted
                  ? "border-emerald-500 text-emerald-600"
                  : isTask
                    ? "border-amber-500 text-amber-600"
                    : "border-primary/30 text-primary"
              )}
            >
              <Icon className="h-4 w-4" />
            </div>
            <div
              className={cn(
                "min-w-0 flex-1 rounded-lg border px-3 py-2.5",
                isAlt ? "bg-muted/50" : "bg-background"
              )}
            >
              <div className="mb-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
                <span className="font-medium uppercase tracking-wide text-foreground/80">{title}</span>
                <span>·</span>
                <span>{subtitle}</span>
                <span>·</span>
                <span>{formatDateTime(item.createdAt)}</span>
              </div>
              <p className="whitespace-pre-wrap text-sm">{body || "—"}</p>
              {!isTask && renderNoteDetails(item)}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function mergeLeadTimeline(
  notes: Omit<TimelineNote, "kind">[],
  tasks: Omit<TimelineTask, "kind">[]
): TimelineItem[] {
  const merged: TimelineItem[] = [
    ...notes.map((n) => ({ ...n, kind: "note" as const })),
    ...tasks.map((t) => ({ ...t, kind: "task" as const })),
  ];
  return merged.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}
