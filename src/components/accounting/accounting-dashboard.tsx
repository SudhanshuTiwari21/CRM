"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Download, FileSpreadsheet, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatDate } from "@/lib/utils";

interface BillRow {
  id: string;
  publicRef: string;
  pnr: string | null;
  date: string;
  customerName: string;
  customerGstin: string | null;
  buyerGstin: string | null;
  invoiceTaxType: "ITC" | "NON_ITC";
  msmeNumber: string | null;
  segment: string;
  baseFare: number;
  serviceCharge: number;
  cgst: number;
  sgst: number;
  igst: number;
  totalTax: number;
  totalAmount: number;
  hsnSac: string;
  placeOfSupply: string | null;
  paymentStatus: string;
}

interface Summary {
  count: number;
  baseFare: number;
  serviceCharge: number;
  cgst: number;
  sgst: number;
  igst: number;
  totalTax: number;
  totalAmount: number;
}

type TabType = "ALL" | "ITC" | "NON_ITC";

function SummaryCards({ summary }: { summary: Summary }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Tickets</CardTitle></CardHeader>
        <CardContent><p className="text-2xl font-bold">{summary.count}</p></CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Service + Tax</CardTitle></CardHeader>
        <CardContent>
          <p className="text-2xl font-bold">{formatCurrency(summary.serviceCharge + summary.totalTax)}</p>
          <p className="text-xs text-muted-foreground">CGST {formatCurrency(summary.cgst)} · SGST {formatCurrency(summary.sgst)} · IGST {formatCurrency(summary.igst)}</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Base Fare (Reimb.)</CardTitle></CardHeader>
        <CardContent><p className="text-2xl font-bold">{formatCurrency(summary.baseFare)}</p></CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Invoice Total</CardTitle></CardHeader>
        <CardContent><p className="text-2xl font-bold">{formatCurrency(summary.totalAmount)}</p></CardContent>
      </Card>
    </div>
  );
}

function BillsTable({ rows }: { rows: BillRow[] }) {
  if (rows.length === 0) {
    return <p className="py-12 text-center text-muted-foreground">No GST invoices in this period</p>;
  }

  return (
    <div className="rounded-lg border overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Date</TableHead>
            <TableHead>Ticket / Ref</TableHead>
            <TableHead>Customer</TableHead>
            <TableHead>GSTIN</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>MSME</TableHead>
            <TableHead className="text-right">Base Fare</TableHead>
            <TableHead className="text-right">Service</TableHead>
            <TableHead className="text-right">CGST</TableHead>
            <TableHead className="text-right">SGST</TableHead>
            <TableHead className="text-right">IGST</TableHead>
            <TableHead className="text-right">Total</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.id}>
              <TableCell className="whitespace-nowrap">{formatDate(r.date)}</TableCell>
              <TableCell>
                <Link href={`/bookings/${r.id}`} className="font-medium text-primary hover:underline">
                  {r.publicRef}
                </Link>
                {r.pnr && <p className="text-xs text-muted-foreground">PNR {r.pnr}</p>}
                <p className="text-xs text-muted-foreground">{r.segment}</p>
              </TableCell>
              <TableCell>{r.customerName}</TableCell>
              <TableCell className="text-xs font-mono">{r.buyerGstin || r.customerGstin || "-"}</TableCell>
              <TableCell>
                <Badge variant={r.invoiceTaxType === "ITC" ? "default" : "secondary"}>
                  {r.invoiceTaxType === "ITC" ? "B2B ITC" : "B2C"}
                </Badge>
              </TableCell>
              <TableCell className="text-xs font-mono">{r.msmeNumber || "-"}</TableCell>
              <TableCell className="text-right">{formatCurrency(r.baseFare)}</TableCell>
              <TableCell className="text-right">{formatCurrency(r.serviceCharge)}</TableCell>
              <TableCell className="text-right">{r.cgst > 0 ? formatCurrency(r.cgst) : "-"}</TableCell>
              <TableCell className="text-right">{r.sgst > 0 ? formatCurrency(r.sgst) : "-"}</TableCell>
              <TableCell className="text-right">{r.igst > 0 ? formatCurrency(r.igst) : "-"}</TableCell>
              <TableCell className="text-right font-medium">{formatCurrency(r.totalAmount)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export function AccountingDashboard() {
  const [tab, setTab] = useState<TabType>("ALL");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<BillRow[]>([]);
  const [summary, setSummary] = useState<Summary>({
    count: 0, baseFare: 0, serviceCharge: 0, cgst: 0, sgst: 0, igst: 0, totalTax: 0, totalAmount: 0,
  });
  const [b2bCount, setB2bCount] = useState(0);
  const [b2cCount, setB2cCount] = useState(0);
  const [msmeFilter, setMsmeFilter] = useState("");
  const [msmeOptions, setMsmeOptions] = useState<{ label: string; number: string }[]>([]);

  useEffect(() => {
    fetch("/api/crm/msme")
      .then((r) => r.json())
      .then((d) => setMsmeOptions(d.msmes || []))
      .catch(() => setMsmeOptions([]));
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ type: tab });
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    if (msmeFilter) params.set("msme", msmeFilter);
    const res = await fetch(`/api/crm/accounting?${params}`);
    const data = await res.json();
    setRows(data.rows || []);
    setSummary(data.summary || { count: 0, baseFare: 0, serviceCharge: 0, cgst: 0, sgst: 0, igst: 0, totalTax: 0, totalAmount: 0 });
    setB2bCount(data.b2bCount || 0);
    setB2cCount(data.b2cCount || 0);
    setLoading(false);
  }, [tab, from, to, msmeFilter]);

  useEffect(() => { fetchData(); }, [fetchData]);

  function exportUrl(format: "xml" | "csv") {
    const params = new URLSearchParams({ type: tab, format });
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    if (msmeFilter) params.set("msme", msmeFilter);
    return `/api/crm/accounting/tally-export?${params}`;
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap items-end gap-4">
            <div className="space-y-2">
              <Label>From</Label>
              <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>To</Label>
              <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
            </div>
            {msmeOptions.length > 0 && (
              <div className="space-y-2">
                <Label>MSME</Label>
                <select
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                  value={msmeFilter}
                  onChange={(e) => setMsmeFilter(e.target.value)}
                >
                  <option value="">All MSME</option>
                  {msmeOptions.map((m) => (
                    <option key={m.number} value={m.number}>
                      {m.label} - {m.number}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <Button variant="outline" onClick={fetchData}>Apply</Button>
            <div className="ml-auto flex flex-wrap gap-2">
              <Button variant="outline" size="sm" asChild>
                <a href={exportUrl("csv")} download>
                  <FileSpreadsheet className="mr-2 h-4 w-4" />
                  Export CSV
                </a>
              </Button>
              <Button size="sm" asChild>
                <a href={exportUrl("xml")} download>
                  <Download className="mr-2 h-4 w-4" />
                  Tally XML
                </a>
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs value={tab} onValueChange={(v) => setTab(v as TabType)}>
        <TabsList>
          <TabsTrigger value="ALL">All ({b2bCount + b2cCount})</TabsTrigger>
          <TabsTrigger value="ITC">B2B ITC ({b2bCount})</TabsTrigger>
          <TabsTrigger value="NON_ITC">B2C Non-ITC ({b2cCount})</TabsTrigger>
        </TabsList>

        <TabsContent value="ALL" className="space-y-4 mt-4">
          <SummaryCards summary={summary} />
          {loading ? (
            <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : (
            <BillsTable rows={rows} />
          )}
        </TabsContent>

        <TabsContent value="ITC" className="space-y-4 mt-4">
          <SummaryCards summary={summary} />
          {loading ? (
            <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : (
            <BillsTable rows={rows} />
          )}
        </TabsContent>

        <TabsContent value="NON_ITC" className="space-y-4 mt-4">
          <SummaryCards summary={summary} />
          {loading ? (
            <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : (
            <BillsTable rows={rows} />
          )}
        </TabsContent>
      </Tabs>

      <p className="text-xs text-muted-foreground">
        Tally XML imports as Sales vouchers with party ledger, fare reimbursement, service charges, and CGST/SGST/IGST output ledgers.
        Ensure matching ledger names exist in Tally before import.
      </p>
    </div>
  );
}
