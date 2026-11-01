"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, Search } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCurrency } from "@/lib/utils";

interface CustomerOption {
  id: string;
  customerId: string;
  branchId: string | null;
  name: string;
  phone: string;
  gstin: string | null;
  branchName: string | null;
}

interface LedgerRow {
  id: string;
  date: string;
  bookingTypeLines: string[];
  voucherTypeLines: string[];
  voucherNo: string;
  debit: number | null;
  credit: number | null;
  closingBalance: number;
  balanceType: "Dr" | "Cr";
}

interface LedgerReport {
  customer: {
    id: string;
    name: string;
    phone: string;
    gstin: string | null;
    address: string | null;
    city: string | null;
    state: string | null;
    branchId: string | null;
    branchName: string | null;
  };
  period: { from: string | null; to: string | null };
  openingBalance: number;
  openingBalanceType: "Dr" | "Cr";
  rows: LedgerRow[];
  totals: {
    debit: number;
    credit: number;
    closingBalance: number;
    balanceType: "Dr" | "Cr";
  };
}

function formatLedgerDate(iso: string) {
  const d = new Date(iso);
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
  }).format(d);
}

function MultiLineCell({ lines }: { lines: string[] }) {
  if (lines.length === 0) return <span className="text-muted-foreground">-</span>;
  return (
    <div className="space-y-0.5 text-sm leading-snug">
      {lines.map((line) => (
        <p key={line}>{line}</p>
      ))}
    </div>
  );
}

function defaultFromDate() {
  const d = new Date();
  d.setMonth(3, 1);
  if (d > new Date()) d.setFullYear(d.getFullYear() - 1);
  return d.toISOString().slice(0, 10);
}

export function CustomerLedgerPanel() {
  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [customerId, setCustomerId] = useState("");
  const [from, setFrom] = useState(defaultFromDate());
  const [to, setTo] = useState(new Date().toISOString().slice(0, 10));
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingCustomers, setLoadingCustomers] = useState(true);
  const [report, setReport] = useState<LedgerReport | null>(null);

  const loadCustomers = useCallback(async (q?: string) => {
    setLoadingCustomers(true);
    try {
      const params = new URLSearchParams({ list: "customers" });
      if (q?.trim()) params.set("search", q.trim());
      const res = await fetch(`/api/crm/accounting/customer-ledger?${params}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load customers");
      setCustomers(data.customers || []);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load customers");
    } finally {
      setLoadingCustomers(false);
    }
  }, []);

  useEffect(() => {
    loadCustomers();
  }, [loadCustomers]);

  async function loadLedger() {
    if (!customerId) {
      toast.error("Select a customer");
      return;
    }
    setLoading(true);
    try {
      const params = new URLSearchParams({ customerId });
      if (from) params.set("from", from);
      if (to) params.set("to", to);
      const res = await fetch(`/api/crm/accounting/customer-ledger?${params}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load ledger");
      setReport(data);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load ledger");
    } finally {
      setLoading(false);
    }
  }

  const periodLabel =
    report?.period.from && report?.period.to
      ? `${formatLedgerDate(report.period.from)} to ${formatLedgerDate(report.period.to)}`
      : "All time";

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Customer Ledger</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <div className="space-y-2 sm:col-span-2">
            <Label>Ledger account</Label>
            <div className="flex gap-2">
              <Select value={customerId} onValueChange={setCustomerId}>
                <SelectTrigger>
                  <SelectValue
                    placeholder={loadingCustomers ? "Loading…" : "Select customer / branch"}
                  />
                </SelectTrigger>
                <SelectContent>
                  {customers.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name} · {c.phone}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <p className="text-xs text-muted-foreground">
              Customers with multiple branches appear once per branch (GSTIN-wise ledger).
            </p>
          </div>
          <div className="space-y-2">
            <Label>From</Label>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>To</Label>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
          <div className="flex items-end">
            <Button onClick={loadLedger} disabled={loading || !customerId} className="w-full">
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />}
              View Ledger
            </Button>
          </div>
          <div className="space-y-2 sm:col-span-2 lg:col-span-5">
            <Label>Search customers</Label>
            <div className="flex gap-2">
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Name, phone, GSTIN"
              />
              <Button type="button" variant="outline" onClick={() => loadCustomers(search)}>
                Search
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {report && (
        <Card>
          <CardHeader className="space-y-2 border-b pb-4">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <CardTitle className="text-lg">{report.customer.name}</CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  Period: {periodLabel}
                  {report.customer.branchName ? ` · Branch ${report.customer.branchName}` : ""}
                  {report.customer.gstin && ` · GSTIN ${report.customer.gstin}`}
                </p>
                {(report.customer.address || report.customer.city) && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {[report.customer.address, report.customer.city, report.customer.state]
                      .filter(Boolean)
                      .join(", ")}
                  </p>
                )}
              </div>
              <div className="text-right text-sm">
                <p className="text-muted-foreground">Opening balance</p>
                <p className="font-semibold">
                  {formatCurrency(report.openingBalance)} {report.openingBalanceType}
                </p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="w-[90px]">Date</TableHead>
                    <TableHead className="min-w-[180px]">Booking Type</TableHead>
                    <TableHead className="min-w-[140px]">Voucher Type</TableHead>
                    <TableHead className="w-[110px]">Voucher No</TableHead>
                    <TableHead className="text-right w-[100px]">Debit</TableHead>
                    <TableHead className="text-right w-[100px]">Credit</TableHead>
                    <TableHead className="text-right w-[120px]">Closing Balance</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {report.rows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="py-12 text-center text-muted-foreground">
                        No transactions in this period
                      </TableCell>
                    </TableRow>
                  ) : (
                    report.rows.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell className="whitespace-nowrap text-sm">
                          {row.id === "opening" ? formatLedgerDate(row.date) : formatLedgerDate(row.date)}
                        </TableCell>
                        <TableCell>
                          <MultiLineCell lines={row.bookingTypeLines} />
                        </TableCell>
                        <TableCell>
                          <MultiLineCell lines={row.voucherTypeLines} />
                        </TableCell>
                        <TableCell className="font-mono text-sm">{row.voucherNo}</TableCell>
                        <TableCell className="text-right tabular-nums">
                          {row.debit != null ? formatCurrency(row.debit) : ""}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {row.credit != null ? formatCurrency(row.credit) : ""}
                        </TableCell>
                        <TableCell className="text-right tabular-nums font-medium">
                          {formatCurrency(row.closingBalance)} {row.balanceType}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                  {report.rows.length > 0 && (
                    <TableRow className="bg-muted/30 font-semibold">
                      <TableCell colSpan={4} className="text-right">
                        Closing Balance
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatCurrency(report.totals.debit)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatCurrency(report.totals.credit)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatCurrency(report.totals.closingBalance)} {report.totals.balanceType}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
            {report.customer.id && (
              <p className="px-6 py-3 text-xs text-muted-foreground border-t">
                <Link href={`/customers/${report.customer.id}`} className="text-primary hover:underline">
                  View customer profile
                </Link>
              </p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
