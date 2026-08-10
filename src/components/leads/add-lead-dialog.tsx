"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  LEAD_PRODUCT_OPTIONS,
  LEAD_SOURCE_OPTIONS,
  LEAD_STATUS_OPTIONS,
} from "@/lib/constants/lead";
import { createLeadSchema, type CreateLeadInput } from "@/lib/validators/lead";
import { getFirstFormErrorMessage } from "@/lib/form-errors";

interface AgentOption {
  id: string;
  name: string;
}

export function AddLeadDialog({
  trigger,
  onCreated,
}: {
  trigger: React.ReactNode;
  onCreated?: () => void;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [agents, setAgents] = useState<AgentOption[]>([]);

  const form = useForm<CreateLeadInput>({
    resolver: zodResolver(createLeadSchema),
    defaultValues: {
      name: "",
      phone: "",
      email: "",
      company: "",
      source: "WHATSAPP",
      status: "NEW",
      productInterest: "FLIGHT",
      estimatedValue: undefined,
      nextFollowUpAt: "",
      requirement: "",
      assignedAgentId: null,
      note: "",
    },
  });

  useEffect(() => {
    if (!open) return;
    fetch("/api/crm/settings")
      .then((r) => r.json())
      .then((d) => {
        const users = (d.users || []) as { id: string; name: string; active: boolean }[];
        setAgents(users.filter((u) => u.active).map((u) => ({ id: u.id, name: u.name })));
      })
      .catch(() => setAgents([]));
  }, [open]);

  async function onSubmit(values: CreateLeadInput) {
    setLoading(true);
    try {
      const res = await fetch("/api/crm/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...values,
          phone: values.phone || "",
          email: values.email || "",
          estimatedValue: values.estimatedValue || null,
          nextFollowUpAt: values.nextFollowUpAt || null,
          assignedAgentId: values.assignedAgentId || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create lead");
      toast.success("Lead created");
      setOpen(false);
      form.reset();
      onCreated?.();
      router.push(`/leads/${data.id}`);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create lead");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add Lead</DialogTitle>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={form.handleSubmit(onSubmit, (errors) => {
            toast.error(getFirstFormErrorMessage(errors));
          })}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label>Name *</Label>
              <Input {...form.register("name")} placeholder="Customer / contact name" />
            </div>
            <div className="space-y-2">
              <Label>Phone</Label>
              <Input {...form.register("phone")} placeholder="10-digit mobile" />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input {...form.register("email")} placeholder="optional" />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Company</Label>
              <Input {...form.register("company")} placeholder="Optional company name" />
            </div>
            <div className="space-y-2">
              <Label>Source</Label>
              <Select
                value={form.watch("source")}
                onValueChange={(v) => form.setValue("source", v as CreateLeadInput["source"])}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LEAD_SOURCE_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select
                value={form.watch("status") || "NEW"}
                onValueChange={(v) => form.setValue("status", v as CreateLeadInput["status"])}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LEAD_STATUS_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Product interest</Label>
              <Select
                value={form.watch("productInterest") || "FLIGHT"}
                onValueChange={(v) =>
                  form.setValue("productInterest", v as "FLIGHT" | "HOTEL" | "BUS")
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LEAD_PRODUCT_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Estimated value (INR)</Label>
              <Input type="number" min={0} step="0.01" {...form.register("estimatedValue")} />
            </div>
            <div className="space-y-2">
              <Label>Next follow-up</Label>
              <Input type="datetime-local" {...form.register("nextFollowUpAt")} />
            </div>
            <div className="space-y-2">
              <Label>Assign to</Label>
              <Select
                value={form.watch("assignedAgentId") || "__none__"}
                onValueChange={(v) =>
                  form.setValue("assignedAgentId", v === "__none__" ? null : v)
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Unassigned" />
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
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Requirement</Label>
              <Textarea
                {...form.register("requirement")}
                rows={3}
                placeholder="e.g. DEL-BOM 2 adults next week, flexible dates"
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Initial note</Label>
              <Textarea {...form.register("note")} rows={2} placeholder="Optional first note" />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create Lead
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
