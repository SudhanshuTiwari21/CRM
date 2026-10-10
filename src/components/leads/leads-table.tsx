"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Search, ChevronLeft, ChevronRight, MessageCircle, Mail } from "lucide-react";
import { toast } from "sonner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LeadStatusBadge } from "@/components/leads/lead-status-badge";
import { LeadFollowUpDialog, type FollowUpLead } from "@/components/leads/lead-follow-up-dialog";
import {
  LEAD_CUSTOMER_SEGMENT_LABELS,
  LEAD_PROGRESS_OPTIONS,
  LEAD_SERVICE_TYPE_LABELS,
  LEAD_TEMPERATURE_ACTIVE,
  LEAD_TEMPERATURE_COLORS,
  LEAD_TEMPERATURE_LABELS,
  LEAD_TEMPERATURE_OPTIONS,
  formatLeadPax,
  getServiceDescription,
  type LeadProgressFilter,
} from "@/lib/constants/lead";
import { TRIP_PLAN_STATUS_LABELS } from "@/lib/constants/trip-plan";
import { formatCurrency } from "@/lib/utils";
import { cn } from "@/lib/utils";
import type {
  LeadCustomerSegment,
  LeadServiceType,
  LeadSource,
  LeadStatus,
  LeadTemperature,
} from "@prisma/client";

interface AgentOption {
  id: string;
  name: string;
}

interface LeadRow {
  id: string;
  queryRef: string | null;
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
  destinations: string | null;
  adultCount: number | null;
  childCount: number | null;
  infantCount: number | null;
  requirement: string | null;
  estimatedValue: string | number | null;
  nextFollowUpAt: string | null;
  createdAt: string;
  assignedAgent: { id: string; name: string } | null;
  assignedOps: { id: string; name: string } | null;
  _count: { notes: number };
  tripPlans?: {
    id: string;
    version: number;
    status: string;
    title: string;
    offerPrice: string | number;
    currency: string;
  }[];
}

function whatsAppHref(phone: string) {
  const digits = phone.replace(/\D/g, "");
  const normalized = digits.length === 10 ? `91${digits}` : digits;
  return `https://wa.me/${normalized}`;
}

function formatTravelDate(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "2-digit",
  }).format(new Date(value));
}

function formatQueryDate(value: string) {
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(value));
}

export function LeadsTable({ refreshKey = 0 }: { refreshKey?: number }) {
  const [leads, setLeads] = useState<LeadRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [temperature, setTemperature] = useState<LeadTemperature | "ALL">("ALL");
  const [progress, setProgress] = useState<LeadProgressFilter>("IN_PROGRESS");
  const [assignee, setAssignee] = useState("ALL");
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [agents, setAgents] = useState<AgentOption[]>([]);
  const [bulkSalesAgent, setBulkSalesAgent] = useState("");
  const [bulkOpsAgent, setBulkOpsAgent] = useState("");
  const [assigning, setAssigning] = useState(false);
  const [followUpLead, setFollowUpLead] = useState<FollowUpLead | null>(null);
  const [followUpOpen, setFollowUpOpen] = useState(false);
  const [temperatureCounts, setTemperatureCounts] = useState<Record<string, number>>({});
  const [progressCounts, setProgressCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    fetch("/api/crm/settings")
      .then((r) => r.json())
      .then((d) => {
        const users = (d.users || []) as { id: string; name: string; active: boolean }[];
        setAgents(users.filter((u) => u.active).map((u) => ({ id: u.id, name: u.name })));
      })
      .catch(() => setAgents([]));
  }, []);

  const fetchLeads = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({
      page: String(page),
      limit: "20",
      progress,
    });
    if (debouncedSearch) params.set("search", debouncedSearch);
    if (temperature !== "ALL") params.set("temperature", temperature);
    if (assignee !== "ALL") params.set("assignee", assignee);

    const res = await fetch(`/api/crm/leads?${params}`);
    const data = await res.json();
    setLeads(data.leads || []);
    setTotal(data.total || 0);
    setTemperatureCounts(data.temperatureCounts || {});
    setProgressCounts(data.progressCounts || {});
    setLoading(false);
    setSelected(new Set());
  }, [page, debouncedSearch, temperature, progress, assignee]);

  useEffect(() => {
    void fetchLeads();
  }, [fetchLeads, refreshKey]);

  const totalPages = Math.ceil(total / 20);
  const allSelected = leads.length > 0 && leads.every((l) => selected.has(l.id));

  const temperatureTotal = useMemo(
    () => Object.values(temperatureCounts).reduce((a, b) => a + b, 0),
    [temperatureCounts]
  );

  function openFollowUp(lead: LeadRow) {
    setFollowUpLead({
      id: lead.id,
      name: lead.name,
      email: lead.email,
      temperature: lead.temperature,
      assignedAgentId: lead.assignedAgent?.id || null,
    });
    setFollowUpOpen(true);
  }

  async function handleBulkAssign(role: "sales" | "ops") {
    const agentId = role === "sales" ? bulkSalesAgent : bulkOpsAgent;
    if (selected.size === 0) {
      toast.error("Select at least one lead");
      return;
    }
    if (!agentId || agentId === "__none__") {
      toast.error(`Choose a ${role === "sales" ? "sales" : "ops"} user`);
      return;
    }

    setAssigning(true);
    try {
      const res = await fetch("/api/crm/leads/bulk-assign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leadIds: Array.from(selected),
          ...(role === "sales" ? { assignedAgentId: agentId } : { assignedOpsId: agentId }),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Assign failed");
      toast.success(`Assigned ${data.updated} lead(s)`);
      void fetchLeads();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Assign failed");
    } finally {
      setAssigning(false);
    }
  }

  function toggleAll(checked: boolean) {
    setSelected(checked ? new Set(leads.map((l) => l.id)) : new Set());
  }

  function toggleOne(id: string, checked: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  return (
    <div className="space-y-4">
      {/* Bulk assign bar */}
      <div className="flex flex-wrap items-end gap-3 rounded-lg border bg-muted/30 p-3">
        <div className="min-w-[180px] flex-1 space-y-1">
          <p className="text-xs font-medium text-muted-foreground">Assign sales users</p>
          <div className="flex gap-2">
            <Select value={bulkSalesAgent} onValueChange={setBulkSalesAgent}>
              <SelectTrigger className="h-9 bg-background">
                <SelectValue placeholder="Select sales user" />
              </SelectTrigger>
              <SelectContent>
                {agents.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              size="sm"
              className="h-9"
              disabled={assigning}
              onClick={() => handleBulkAssign("sales")}
            >
              Assign
            </Button>
          </div>
        </div>
        <div className="min-w-[180px] flex-1 space-y-1">
          <p className="text-xs font-medium text-muted-foreground">Assign ops users</p>
          <div className="flex gap-2">
            <Select value={bulkOpsAgent} onValueChange={setBulkOpsAgent}>
              <SelectTrigger className="h-9 bg-background">
                <SelectValue placeholder="Select ops user" />
              </SelectTrigger>
              <SelectContent>
                {agents.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              size="sm"
              variant="secondary"
              className="h-9"
              disabled={assigning}
              onClick={() => handleBulkAssign("ops")}
            >
              Assign
            </Button>
          </div>
        </div>
      </div>

      {/* Temperature tabs */}
      <div className="flex flex-wrap items-center gap-4 border-b pb-1">
        <button
          type="button"
          onClick={() => {
            setTemperature("ALL");
            setPage(1);
          }}
          className={cn(
            "border-b-2 px-1 pb-2 text-sm font-medium transition-colors",
            temperature === "ALL"
              ? "border-primary text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground"
          )}
        >
          All ({temperatureTotal})
        </button>
        {LEAD_TEMPERATURE_OPTIONS.map((o) => (
          <button
            key={o.value}
            type="button"
            onClick={() => {
              setTemperature(o.value);
              setPage(1);
            }}
            className={cn(
              "border-b-2 px-1 pb-2 text-sm font-medium transition-colors",
              temperature === o.value
                ? LEAD_TEMPERATURE_ACTIVE[o.value]
                : cn("border-transparent", LEAD_TEMPERATURE_COLORS[o.value], "hover:opacity-80")
            )}
          >
            {o.label} ({temperatureCounts[o.value] || 0})
          </button>
        ))}
        <p className="ml-auto text-sm text-muted-foreground">
          Total records found: <span className="font-semibold text-foreground">{total}</span>
        </p>
      </div>

      {/* Progress tabs */}
      <div className="flex flex-wrap gap-2">
        {LEAD_PROGRESS_OPTIONS.map((o) => (
          <button
            key={o.value}
            type="button"
            onClick={() => {
              setProgress(o.value);
              setPage(1);
            }}
            className={cn(
              "rounded-md border px-3 py-1.5 text-xs font-medium transition-colors",
              progress === o.value
                ? "border-primary bg-primary text-primary-foreground"
                : "bg-background hover:bg-muted"
            )}
          >
            {o.label} ({progressCounts[o.value] || 0})
          </button>
        ))}
      </div>

      {/* Search & filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative min-w-[220px] flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search name, phone, query ref, destination..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </div>
        <Select
          value={assignee}
          onValueChange={(v) => {
            setAssignee(v);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Assignee" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All assignees</SelectItem>
            <SelectItem value="UNASSIGNED">Unassigned</SelectItem>
            <SelectItem value="ME">My leads</SelectItem>
            {agents.map((a) => (
              <SelectItem key={a.id} value={a.id}>
                {a.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40">
              <TableHead className="w-10">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={(e) => toggleAll(e.target.checked)}
                  className="h-4 w-4 rounded border-input"
                  aria-label="Select all leads"
                />
              </TableHead>
              <TableHead>Query date</TableHead>
              <TableHead>Customer details</TableHead>
              <TableHead>Pax / type</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Travel date</TableHead>
              <TableHead>Destinations</TableHead>
              <TableHead>Proposal</TableHead>
              <TableHead>Lead stage</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={9} className="h-24 text-center text-muted-foreground">
                  Loading...
                </TableCell>
              </TableRow>
            ) : leads.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="h-24 text-center text-muted-foreground">
                  No leads found
                </TableCell>
              </TableRow>
            ) : (
              leads.map((lead) => (
                <TableRow key={lead.id} className="align-top">
                  <TableCell>
                    <input
                      type="checkbox"
                      checked={selected.has(lead.id)}
                      onChange={(e) => toggleOne(lead.id, e.target.checked)}
                      className="h-4 w-4 rounded border-input"
                      aria-label={`Select ${lead.name}`}
                    />
                  </TableCell>
                  <TableCell className="min-w-[120px] text-xs">
                    <p className="font-medium">{formatQueryDate(lead.createdAt)}</p>
                    <Link
                      href={`/leads/${lead.id}`}
                      className="text-primary hover:underline"
                    >
                      {lead.queryRef || "—"}
                    </Link>
                  </TableCell>
                  <TableCell className="min-w-[180px]">
                    <Link
                      href={`/leads/${lead.id}`}
                      className="font-medium text-primary hover:underline"
                    >
                      {lead.name}
                    </Link>
                    {lead.phone && (
                      <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                        <span>{lead.phone}</span>
                        <a
                          href={whatsAppHref(lead.phone)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-green-600 hover:text-green-700"
                          title="WhatsApp"
                        >
                          <MessageCircle className="h-3.5 w-3.5" />
                        </a>
                      </p>
                    )}
                    {lead.email && (
                      <a
                        href={`mailto:${lead.email}`}
                        className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground hover:text-primary"
                      >
                        <Mail className="h-3 w-3 shrink-0" />
                        {lead.email}
                      </a>
                    )}
                    {lead.assignedAgent && (
                      <p className="mt-1 text-[10px] text-muted-foreground">
                        Sales: {lead.assignedAgent.name}
                      </p>
                    )}
                  </TableCell>
                  <TableCell className="text-xs">
                    <p>{formatLeadPax(lead.adultCount, lead.childCount, lead.infantCount)}</p>
                    <p className="text-muted-foreground">
                      {LEAD_CUSTOMER_SEGMENT_LABELS[lead.customerSegment]}
                    </p>
                  </TableCell>
                  <TableCell className="max-w-[160px] text-xs">
                    <p className="line-clamp-2">
                      {lead.serviceType
                        ? `${LEAD_SERVICE_TYPE_LABELS[lead.serviceType]} Agency`
                        : getServiceDescription(lead.serviceType, lead.requirement)}
                    </p>
                  </TableCell>
                  <TableCell className="text-xs">{formatTravelDate(lead.travelDate)}</TableCell>
                  <TableCell className="max-w-[140px] text-xs">
                    {lead.destinations || "—"}
                  </TableCell>
                  <TableCell className="text-xs">
                    {lead.tripPlans?.[0] ? (
                      <div className="space-y-1">
                        <Link
                          href={`/leads/${lead.id}/trip-plan/${lead.tripPlans[0].id}`}
                          className="font-medium text-blue-700 hover:underline"
                        >
                          V{lead.tripPlans[0].version} ·{" "}
                          {formatCurrency(Number(lead.tripPlans[0].offerPrice))}
                        </Link>
                        <p className="text-[10px] text-muted-foreground">
                          {TRIP_PLAN_STATUS_LABELS[
                            lead.tripPlans[0].status as keyof typeof TRIP_PLAN_STATUS_LABELS
                          ] || lead.tripPlans[0].status}
                        </p>
                      </div>
                    ) : (
                      <Link
                        href={`/leads/${lead.id}/trip-plan/new`}
                        className="text-muted-foreground hover:text-blue-700 hover:underline"
                      >
                        Create plan
                      </Link>
                    )}
                  </TableCell>
                  <TableCell className="min-w-[130px] space-y-1.5">
                    <LeadStatusBadge status={lead.status} />
                    {lead.temperature !== "NONE" && (
                      <p
                        className={cn(
                          "text-[10px] font-medium uppercase tracking-wide",
                          LEAD_TEMPERATURE_COLORS[lead.temperature]
                        )}
                      >
                        {LEAD_TEMPERATURE_LABELS[lead.temperature]}
                      </p>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 w-full border-amber-300 bg-amber-50 text-[11px] text-amber-800 hover:bg-amber-100"
                      onClick={() => openFollowUp(lead)}
                    >
                      Follow up
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {total} record{total !== 1 ? "s" : ""}
          {selected.size > 0 && ` · ${selected.size} selected`}
        </p>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="flex items-center px-2 text-sm">
            Page {page} of {totalPages || 1}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <LeadFollowUpDialog
        lead={followUpLead}
        open={followUpOpen}
        onOpenChange={setFollowUpOpen}
        onSuccess={() => void fetchLeads()}
      />
    </div>
  );
}
