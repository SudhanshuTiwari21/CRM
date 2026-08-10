"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatDateTime } from "@/lib/utils";

interface NoteRow {
  id: string;
  type: string;
  body: string;
  createdAt: string;
  user: { id: string; name: string } | null;
}

export function LeadNotesPanel({ leadId, notes }: { leadId: string; notes: NoteRow[] }) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [type, setType] = useState("NOTE");
  const [loading, setLoading] = useState(false);

  async function handleAdd() {
    if (!body.trim()) {
      toast.error("Enter a note");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/crm/leads/${leadId}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body, type }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to add note");
      toast.success("Note added");
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

      <div className="space-y-3">
        {notes.length === 0 ? (
          <p className="text-sm text-muted-foreground">No activity yet</p>
        ) : (
          notes.map((note) => (
            <div key={note.id} className="rounded-lg border p-3">
              <div className="mb-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span className="rounded bg-muted px-1.5 py-0.5 font-medium text-foreground">
                  {note.type.replace(/_/g, " ")}
                </span>
                <span>{note.user?.name || "System"}</span>
                <span>·</span>
                <span>{formatDateTime(note.createdAt)}</span>
              </div>
              <p className="whitespace-pre-wrap text-sm">{note.body}</p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
