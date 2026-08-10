"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Search, ChevronLeft, ChevronRight } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LeadStatusBadge } from "@/components/leads/lead-status-badge";
import { LEAD_SOURCE_LABELS, LEAD_STATUS_OPTIONS } from "@/lib/constants/lead";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import type { LeadSource, LeadStatus, ProductType } from "@prisma/client";

interface LeadRow {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  company: string | null;
  source: LeadSource;
  status: LeadStatus;
  productInterest: ProductType | null;
  estimatedValue: string | number | null;
  nextFollowUpAt: string | null;
  assignedAgent: { id: string; name: string } | null;
  _count: { notes: number };
}

export function LeadsTable({ refreshKey = 0 }: { refreshKey?: number }) {
  const [leads, setLeads] = useState<LeadRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("ALL");
  const [loading, setLoading] = useState(true);
  const [statusCounts, setStatusCounts] = useState<Record<string, number>>({});

  const fetchLeads = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: "20" });
    if (search) params.set("search", search);
    if (status !== "ALL") params.set("status", status);
    const res = await fetch(`/api/crm/leads?${params}`);
    const data = await res.json();
    setLeads(data.leads || []);
    setTotal(data.total || 0);
    setStatusCounts(data.statusCounts || {});
    setLoading(false);
  }, [page, search, status]);

  useEffect(() => {
    void fetchLeads();
  }, [fetchLeads, refreshKey]);

  const totalPages = Math.ceil(total / 20);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => {
            setStatus("ALL");
            setPage(1);
          }}
          className={`rounded-full border px-3 py-1 text-xs font-medium ${
            status === "ALL" ? "border-primary bg-primary text-primary-foreground" : "bg-background"
          }`}
        >
          All ({Object.values(statusCounts).reduce((a, b) => a + b, 0)})
        </button>
        {LEAD_STATUS_OPTIONS.map((o) => (
          <button
            key={o.value}
            type="button"
            onClick={() => {
              setStatus(o.value);
              setPage(1);
            }}
            className={`rounded-full border px-3 py-1 text-xs font-medium ${
              status === o.value
                ? "border-primary bg-primary text-primary-foreground"
                : "bg-background"
            }`}
          >
            {o.label} ({statusCounts[o.value] || 0})
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search leads..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </div>
        <Select
          value={status}
          onValueChange={(v) => {
            setStatus(v);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All statuses</SelectItem>
            {LEAD_STATUS_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Lead</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Source</TableHead>
              <TableHead>Interest</TableHead>
              <TableHead>Value</TableHead>
              <TableHead>Follow-up</TableHead>
              <TableHead>Assignee</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                  Loading...
                </TableCell>
              </TableRow>
            ) : leads.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                  No leads found
                </TableCell>
              </TableRow>
            ) : (
              leads.map((lead) => (
                <TableRow key={lead.id}>
                  <TableCell>
                    <Link href={`/leads/${lead.id}`} className="font-medium text-primary hover:underline">
                      {lead.name}
                    </Link>
                    <p className="text-xs text-muted-foreground">
                      {[lead.phone, lead.company].filter(Boolean).join(" · ") || lead.email || "—"}
                    </p>
                  </TableCell>
                  <TableCell>
                    <LeadStatusBadge status={lead.status} />
                  </TableCell>
                  <TableCell>{LEAD_SOURCE_LABELS[lead.source]}</TableCell>
                  <TableCell>{lead.productInterest || "—"}</TableCell>
                  <TableCell>
                    {lead.estimatedValue != null ? formatCurrency(Number(lead.estimatedValue)) : "—"}
                  </TableCell>
                  <TableCell className="text-sm">
                    {lead.nextFollowUpAt ? formatDateTime(lead.nextFollowUpAt) : "—"}
                  </TableCell>
                  <TableCell>{lead.assignedAgent?.name || "Unassigned"}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{total} leads</p>
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
    </div>
  );
}
