"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  LEAD_CALL_OUTCOME_LABELS,
  LEAD_QUICK_SCHEDULE_OPTIONS,
  LEAD_TEMPERATURE_OPTIONS,
} from "@/lib/constants/lead";
import { cn } from "@/lib/utils";
import type { LeadCallDirection, LeadCallOutcome, LeadTemperature, LeadTaskType } from "@prisma/client";

export interface FollowUpLead {
  id: string;
  name: string;
  email?: string | null;
  temperature?: LeadTemperature;
  assignedAgentId?: string | null;
}

interface AgentOption {
  id: string;
  name: string;
  email?: string;
  active?: boolean;
}

const CALL_OUTCOMES = Object.keys(LEAD_CALL_OUTCOME_LABELS) as LeadCallOutcome[];

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function defaultTimeValue() {
  const d = new Date();
  d.setMinutes(d.getMinutes() + 15);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function combineDateTime(date: string, time: string) {
  if (!date) return null;
  const [h, m] = (time || "09:00").split(":").map(Number);
  const d = new Date(`${date}T00:00:00`);
  d.setHours(h || 9, m || 0, 0, 0);
  return d.toISOString();
}

function dateFromQuickSchedule(scheduleId: string) {
  const opt = LEAD_QUICK_SCHEDULE_OPTIONS.find((o) => o.id === scheduleId);
  if (!opt || opt.days === null) return "";
  const d = new Date();
  d.setDate(d.getDate() + opt.days);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function LeadFollowUpDialog({
  lead,
  open,
  onOpenChange,
  onSuccess,
}: {
  lead: FollowUpLead | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [agents, setAgents] = useState<AgentOption[]>([]);

  const [taskType, setTaskType] = useState<LeadTaskType>("CALL");
  const [direction, setDirection] = useState<LeadCallDirection>("OUTGOING");
  const [outcome, setOutcome] = useState<LeadCallOutcome>("UNANSWERED");
  const [scheduleId, setScheduleId] = useState("today");
  const [customDate, setCustomDate] = useState("");
  const [time, setTime] = useState(defaultTimeValue);
  const [assignedToId, setAssignedToId] = useState("");
  const [details, setDetails] = useState("");
  const [isCompleted, setIsCompleted] = useState(false);
  const [temperature, setTemperature] = useState<LeadTemperature>("NONE");

  useEffect(() => {
    if (!open) return;
    fetch("/api/crm/settings")
      .then((r) => r.json())
      .then((d) => {
        const users = (d.users || []) as AgentOption[];
        setAgents(users.filter((u) => u.active !== false));
      })
      .catch(() => setAgents([]));
  }, [open]);

  useEffect(() => {
    if (!open || !lead) return;
    setTaskType("CALL");
    setDirection("OUTGOING");
    setOutcome("UNANSWERED");
    setScheduleId("today");
    setCustomDate("");
    setTime(defaultTimeValue());
    setDetails("");
    setIsCompleted(false);
    setTemperature(lead.temperature || "NONE");
    setAssignedToId(lead.assignedAgentId || "");
  }, [open, lead]);

  const scheduledDate = useMemo(() => {
    if (scheduleId === "custom") return customDate;
    return dateFromQuickSchedule(scheduleId);
  }, [scheduleId, customDate]);

  async function handleSubmit() {
    if (!lead) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/crm/leads/${lead.id}/tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: taskType,
          direction: taskType === "CALL" ? direction : undefined,
          outcome: taskType === "CALL" ? outcome : undefined,
          scheduledAt: isCompleted ? null : combineDateTime(scheduledDate, time),
          isCompleted,
          details,
          temperature,
          assignedToId: assignedToId || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save follow-up");
      toast.success(isCompleted ? "Follow-up completed" : "Follow-up scheduled");
      onOpenChange(false);
      onSuccess?.();
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save follow-up");
    } finally {
      setLoading(false);
    }
  }

  const assignedLabel = useMemo(() => {
    const agent = agents.find((a) => a.id === assignedToId);
    return agent ? `${agent.name}${agent.email ? ` (${agent.email})` : ""}` : "";
  }, [agents, assignedToId]);

  if (!lead) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Add To Do / Follow Up</DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="inline-flex rounded-md border p-0.5">
              {(["CALL", "TODO"] as LeadTaskType[]).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTaskType(t)}
                  className={cn(
                    "rounded px-3 py-1.5 text-sm font-medium",
                    taskType === t ? "bg-primary text-primary-foreground" : "text-muted-foreground"
                  )}
                >
                  {t === "CALL" ? "Call" : "To Do"}
                </button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">Remind in 15 minutes</p>
          </div>

          {taskType === "CALL" && (
            <>
              <div className="inline-flex rounded-md border p-0.5">
                {(["OUTGOING", "INCOMING"] as LeadCallDirection[]).map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setDirection(d)}
                    className={cn(
                      "rounded px-3 py-1.5 text-sm font-medium",
                      direction === d ? "bg-primary text-primary-foreground" : "text-muted-foreground"
                    )}
                  >
                    {d === "OUTGOING" ? "Out Going" : "Incoming"}
                  </button>
                ))}
              </div>

              <div className="space-y-2">
                <Label>Out come</Label>
                <div className="flex flex-wrap gap-2">
                  {CALL_OUTCOMES.map((o) => (
                    <button
                      key={o}
                      type="button"
                      onClick={() => setOutcome(o)}
                      className={cn(
                        "rounded-md border px-3 py-1.5 text-sm",
                        outcome === o
                          ? "border-primary bg-primary text-primary-foreground"
                          : "bg-background hover:bg-muted"
                      )}
                    >
                      {LEAD_CALL_OUTCOME_LABELS[o]}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          {!isCompleted && (
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2">
                {LEAD_QUICK_SCHEDULE_OPTIONS.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setScheduleId(opt.id)}
                    className={cn(
                      "rounded-md border px-3 py-1.5 text-sm",
                      scheduleId === opt.id
                        ? "border-primary bg-primary text-primary-foreground"
                        : "bg-background hover:bg-muted"
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              {scheduleId === "custom" && (
                <Input type="date" value={customDate} onChange={(e) => setCustomDate(e.target.value)} />
              )}
              <div className="space-y-1">
                <Label>Time</Label>
                <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
              </div>
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label>Assigned to</Label>
              <Select value={assignedToId || "__none__"} onValueChange={(v) => setAssignedToId(v === "__none__" ? "" : v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select agent" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Unassigned</SelectItem>
                  {agents.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {assignedLabel && (
                <p className="truncate text-[11px] text-muted-foreground">{assignedLabel}</p>
              )}
            </div>
            <div className="space-y-1">
              <Label>Customer</Label>
              <Input readOnly value={`${lead.name}${lead.email ? ` (${lead.email})` : ""}`} />
            </div>
          </div>

          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <Label>Details</Label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={isCompleted}
                  onChange={(e) => setIsCompleted(e.target.checked)}
                  className="h-4 w-4 rounded border-input"
                />
                Completed
              </label>
            </div>
            <Textarea
              rows={3}
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              placeholder="Call notes, callback reason..."
            />
          </div>

          <div className="space-y-2">
            <Label>Lead status</Label>
            <div className="flex flex-wrap gap-3">
              {LEAD_TEMPERATURE_OPTIONS.map((opt) => (
                <label key={opt.value} className="flex items-center gap-1.5 text-sm">
                  <input
                    type="radio"
                    name="temperature"
                    checked={temperature === opt.value}
                    onChange={() => setTemperature(opt.value)}
                    className="h-4 w-4"
                  />
                  {opt.label}
                </label>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-2 border-t pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={handleSubmit} disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
