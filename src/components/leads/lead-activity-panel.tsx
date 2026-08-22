"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, PhoneForwarded } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  LeadActivityTimeline,
  mergeLeadTimeline,
  type TimelineItem,
} from "@/components/leads/lead-activity-timeline";
import { LeadFollowUpDialog, type FollowUpLead } from "@/components/leads/lead-follow-up-dialog";
import type { LeadNoteType, LeadTemperature } from "@prisma/client";

interface NoteRow {
  id: string;
  type: LeadNoteType;
  body: string;
  createdAt: string;
  user: { id: string; name: string } | null;
  details?: Record<string, unknown> | null;
}

interface TaskRow {
  id: string;
  type: string;
  direction: string | null;
  outcome: import("@prisma/client").LeadCallOutcome | null;
  scheduledAt: string | null;
  isCompleted: boolean;
  details: string | null;
  temperature: LeadTemperature | null;
  createdAt: string;
  assignedTo: { id: string; name: string } | null;
  createdBy: { id: string; name: string } | null;
}

export function LeadActivityPanel({
  lead,
  notes,
  tasks,
}: {
  lead: FollowUpLead;
  notes: NoteRow[];
  tasks: TaskRow[];
}) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [type, setType] = useState("NOTE");
  const [loading, setLoading] = useState(false);
  const [followUpOpen, setFollowUpOpen] = useState(false);

  const timeline: TimelineItem[] = mergeLeadTimeline(
    notes.map((n) => ({ ...n, details: n.details ?? null })),
    tasks
  );

  async function handleAdd() {
    if (!body.trim()) {
      toast.error("Enter a note");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/crm/leads/${lead.id}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body, type }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to add note");
      toast.success("Activity logged");
      setBody("");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to add note");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <Button
        type="button"
        className="w-full bg-amber-500 text-white hover:bg-amber-600"
        onClick={() => setFollowUpOpen(true)}
      >
        <PhoneForwarded className="mr-2 h-4 w-4" />
        Add follow-up / call log
      </Button>

      <div className="space-y-3 rounded-lg border p-4">
        <div className="flex flex-wrap gap-2">
          <Select value={type} onValueChange={setType}>
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="NOTE">Note</SelectItem>
              <SelectItem value="CALL">Call</SelectItem>
              <SelectItem value="WHATSAPP">WhatsApp</SelectItem>
              <SelectItem value="EMAIL">Email</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={3}
          placeholder="Log a call, WhatsApp reply, or internal note..."
        />
        <Button size="sm" onClick={handleAdd} disabled={loading}>
          {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Add activity
        </Button>
      </div>

      <LeadActivityTimeline items={timeline} />

      <LeadFollowUpDialog
        lead={lead}
        open={followUpOpen}
        onOpenChange={setFollowUpOpen}
        onSuccess={() => router.refresh()}
      />
    </div>
  );
}
