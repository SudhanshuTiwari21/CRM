"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, UserPlus, Trash2 } from "lucide-react";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  LEAD_CUSTOMER_SEGMENT_OPTIONS,
  LEAD_PRODUCT_OPTIONS,
  LEAD_SERVICE_TYPE_OPTIONS,
  LEAD_SOURCE_OPTIONS,
  LEAD_STATUS_OPTIONS,
  LEAD_TEMPERATURE_OPTIONS,
} from "@/lib/constants/lead";
import type {
  LeadCustomerSegment,
  LeadServiceType,
  LeadSource,
  LeadStatus,
  LeadTemperature,
} from "@prisma/client";

interface LeadDetail {
  id: string;
  queryRef?: string | null;
  name: string;
  phone: string | null;
  email: string | null;
  company: string | null;
  source: LeadSource;
  status: LeadStatus;
  temperature: LeadTemperature;
  serviceType: LeadServiceType | null;
  customerSegment: LeadCustomerSegment;
  productInterest: LeadServiceType | null;
  travelDate: string | null;
  returnDate: string | null;
  destinations: string | null;
  adultCount: number | null;
  childCount: number | null;
  infantCount: number | null;
  estimatedValue: string | number | null;
  nextFollowUpAt: string | null;
  lostReason: string | null;
  requirement: string | null;
  assignedAgentId: string | null;
  assignedOpsId: string | null;
  customerId: string | null;
  customer: { id: string; name: string } | null;
}

function toLocalInput(value: string | null) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function toDateInput(value: string | null) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function LeadDetailActions({ lead }: { lead: LeadDetail }) {
  const router = useRouter();
  const { data: session } = useSession();
  const isAdmin = session?.user?.role === "ADMIN";
  const [agents, setAgents] = useState<{ id: string; name: string }[]>([]);
  const [saving, setSaving] = useState(false);
  const [converting, setConverting] = useState(false);
  const [form, setForm] = useState({
    name: lead.name,
    phone: lead.phone || "",
    email: lead.email || "",
    company: lead.company || "",
    source: lead.source,
    status: lead.status,
    temperature: lead.temperature,
    serviceType: lead.serviceType || "",
    customerSegment: lead.customerSegment,
    productInterest: lead.productInterest || "",
    travelDate: toDateInput(lead.travelDate),
    returnDate: toDateInput(lead.returnDate),
    destinations: lead.destinations || "",
    adultCount: lead.adultCount != null ? String(lead.adultCount) : "",
    childCount: lead.childCount != null ? String(lead.childCount) : "",
    infantCount: lead.infantCount != null ? String(lead.infantCount) : "",
    estimatedValue: lead.estimatedValue != null ? String(lead.estimatedValue) : "",
    nextFollowUpAt: toLocalInput(lead.nextFollowUpAt),
    lostReason: lead.lostReason || "",
    requirement: lead.requirement || "",
    assignedAgentId: lead.assignedAgentId || "",
    assignedOpsId: lead.assignedOpsId || "",
  });

  useEffect(() => {
    fetch("/api/crm/settings")
      .then((r) => r.json())
      .then((d) => {
        const users = (d.users || []) as { id: string; name: string; active: boolean }[];
        setAgents(users.filter((u) => u.active).map((u) => ({ id: u.id, name: u.name })));
      })
      .catch(() => setAgents([]));
  }, []);

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch(`/api/crm/leads/${lead.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          phone: form.phone,
          email: form.email,
          company: form.company,
          source: form.source,
          status: form.status,
          temperature: form.temperature,
          serviceType: form.serviceType || null,
          customerSegment: form.customerSegment,
          productInterest: form.productInterest || null,
          travelDate: form.travelDate || null,
          returnDate: form.returnDate || null,
          destinations: form.destinations || null,
          adultCount: form.adultCount ? Number(form.adultCount) : null,
          childCount: form.childCount ? Number(form.childCount) : null,
          infantCount: form.infantCount ? Number(form.infantCount) : null,
          estimatedValue: form.estimatedValue ? Number(form.estimatedValue) : null,
          nextFollowUpAt: form.nextFollowUpAt || null,
          lostReason: form.status === "LOST" ? form.lostReason : null,
          requirement: form.requirement,
          assignedAgentId: form.assignedAgentId || null,
          assignedOpsId: form.assignedOpsId || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Update failed");
      toast.success("Lead updated");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Update failed");
    } finally {
      setSaving(false);
    }
  }

  async function handleConvert() {
    setConverting(true);
    try {
      const res = await fetch(`/api/crm/leads/${lead.id}/convert`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ createCustomer: true }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Convert failed");
      toast.success("Lead converted to customer");
      router.refresh();
      const customerId = data.customerId as string | undefined;
      if (customerId) router.push(`/customers/${customerId}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Convert failed");
    } finally {
      setConverting(false);
    }
  }

  async function handleDelete() {
    if (!confirm("Delete this lead permanently?")) return;
    try {
      const res = await fetch(`/api/crm/leads/${lead.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Delete failed");
      toast.success("Lead deleted");
      router.push("/leads");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Delete failed");
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base">Lead details</CardTitle>
        <div className="flex flex-wrap gap-2">
          {!lead.customerId && (
            <Button size="sm" variant="secondary" onClick={handleConvert} disabled={converting}>
              {converting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <UserPlus className="mr-2 h-4 w-4" />
              )}
              Convert to customer
            </Button>
          )}
          <Button size="sm" onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save
          </Button>
          {isAdmin && (
            <Button size="sm" variant="destructive" onClick={handleDelete}>
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>Name</Label>
          <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </div>
        <div className="space-y-2">
          <Label>Phone</Label>
          <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
        </div>
        <div className="space-y-2">
          <Label>Email</Label>
          <Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        </div>
        <div className="space-y-2">
          <Label>Company</Label>
          <Input
            value={form.company}
            onChange={(e) => setForm({ ...form, company: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label>Status</Label>
          <Select
            value={form.status}
            onValueChange={(v) => setForm({ ...form, status: v as LeadStatus })}
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
          <Label>Source</Label>
          <Select
            value={form.source}
            onValueChange={(v) => setForm({ ...form, source: v as LeadSource })}
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
          <Label>Temperature</Label>
          <Select
            value={form.temperature}
            onValueChange={(v) => setForm({ ...form, temperature: v as LeadTemperature })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {LEAD_TEMPERATURE_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Service type</Label>
          <Select
            value={form.serviceType || "__none__"}
            onValueChange={(v) =>
              setForm({ ...form, serviceType: v === "__none__" ? "" : v })
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">None</SelectItem>
              {LEAD_SERVICE_TYPE_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Customer segment</Label>
          <Select
            value={form.customerSegment}
            onValueChange={(v) =>
              setForm({ ...form, customerSegment: v as LeadCustomerSegment })
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {LEAD_CUSTOMER_SEGMENT_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Travel date</Label>
          <Input
            type="date"
            value={form.travelDate}
            onChange={(e) => setForm({ ...form, travelDate: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label>Return date</Label>
          <Input
            type="date"
            value={form.returnDate}
            onChange={(e) => setForm({ ...form, returnDate: e.target.value })}
          />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label>Destinations</Label>
          <Input
            value={form.destinations}
            onChange={(e) => setForm({ ...form, destinations: e.target.value })}
            placeholder="e.g. Mumbai-Dubai, Delhi-Goa"
          />
        </div>
        <div className="space-y-2">
          <Label>Adults</Label>
          <Input
            type="number"
            min={0}
            value={form.adultCount}
            onChange={(e) => setForm({ ...form, adultCount: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label>Children</Label>
          <Input
            type="number"
            min={0}
            value={form.childCount}
            onChange={(e) => setForm({ ...form, childCount: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label>Infants</Label>
          <Input
            type="number"
            min={0}
            value={form.infantCount}
            onChange={(e) => setForm({ ...form, infantCount: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label>Product interest</Label>
          <Select
            value={form.productInterest || "__none__"}
            onValueChange={(v) =>
              setForm({ ...form, productInterest: v === "__none__" ? "" : v })
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">None</SelectItem>
              {LEAD_PRODUCT_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Estimated value</Label>
          <Input
            type="number"
            value={form.estimatedValue}
            onChange={(e) => setForm({ ...form, estimatedValue: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label>Next follow-up</Label>
          <Input
            type="datetime-local"
            value={form.nextFollowUpAt}
            onChange={(e) => setForm({ ...form, nextFollowUpAt: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label>Sales assignee</Label>
          <Select
            value={form.assignedAgentId || "__none__"}
            onValueChange={(v) =>
              setForm({ ...form, assignedAgentId: v === "__none__" ? "" : v })
            }
          >
            <SelectTrigger>
              <SelectValue />
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
        <div className="space-y-2">
          <Label>Ops assignee</Label>
          <Select
            value={form.assignedOpsId || "__none__"}
            onValueChange={(v) =>
              setForm({ ...form, assignedOpsId: v === "__none__" ? "" : v })
            }
          >
            <SelectTrigger>
              <SelectValue />
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
        {form.status === "LOST" && (
          <div className="space-y-2 sm:col-span-2">
            <Label>Lost reason</Label>
            <Input
              value={form.lostReason}
              onChange={(e) => setForm({ ...form, lostReason: e.target.value })}
              placeholder="Why was this lead lost?"
            />
          </div>
        )}
        <div className="space-y-2 sm:col-span-2">
          <Label>Requirement</Label>
          <Textarea
            rows={3}
            value={form.requirement}
            onChange={(e) => setForm({ ...form, requirement: e.target.value })}
          />
        </div>
        {lead.customer && (
          <p className="sm:col-span-2 text-sm text-muted-foreground">
            Linked customer:{" "}
            <a className="text-primary hover:underline" href={`/customers/${lead.customer.id}`}>
              {lead.customer.name}
            </a>
          </p>
        )}
      </CardContent>
    </Card>
  );
}
