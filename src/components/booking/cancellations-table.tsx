"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { PRODUCT_LABELS } from "@/lib/constants";
import { computeB2BNetRefund } from "@/lib/cancellation-category";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import type { CancellationCategory, ProductType } from "@prisma/client";
import { ChevronLeft, ChevronRight, Loader2, Search } from "lucide-react";
import { parseApiResponse } from "@/lib/parse-api-response";

interface CancellationRow {
  id: string;
  category: CancellationCategory;
  reason: string;
  airlineRefund: string | number | null;
  supplierCharges: string | number | null;
  agencyCharges: string | number | null;
  customerRefund: string | number | null;
  cancellationFee: string | number | null;
  supplierPenalty: string | number | null;
  cancelledAt: string;
  cancelledBy: { name: string } | null;
  booking: {
    id: string;
    publicRef: string;
    pnr: string | null;
    productType: ProductType;
    totalAmount: string | number;
    customer: { name: string };
    flightBooking?: { airline: string } | null;
    hotelBooking?: { propertyName: string } | null;
  };
}

function refundDisplay(row: CancellationRow) {
  if (row.category === "B2B") {
    return computeB2BNetRefund(
      Number(row.airlineRefund || 0),
      Number(row.supplierCharges || 0),
      Number(row.agencyCharges || 0)
    );
  }
  return Number(row.customerRefund || 0);
}

function productDetail(row: CancellationRow) {
  if (row.booking.productType === "FLIGHT") {
    return row.booking.flightBooking?.airline || "Flight";
  }
  if (row.booking.productType === "HOTEL") {
    return row.booking.hotelBooking?.propertyName || "Hotel";
  }
  return PRODUCT_LABELS[row.booking.productType];
}

export function CancellationsTable() {
  const [rows, setRows] = useState<CancellationRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [productType, setProductType] = useState("all");
  const [categoryTab, setCategoryTab] = useState<"all" | CancellationCategory>("all");

  const fetchRows = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: "20" });
    if (search) params.set("search", search);
    if (productType !== "all") params.set("productType", productType);
    if (categoryTab !== "all") params.set("category", categoryTab);

    const res = await fetch(`/api/crm/cancellations?${params}`);
    const { ok, data } = await parseApiResponse(res);
    if (ok) {
      setRows((data.cancellations as CancellationRow[]) || []);
      setTotal((data.total as number) || 0);
    } else {
      setRows([]);
      setTotal(0);
    }
    setLoading(false);
  }, [page, search, productType, categoryTab]);

  useEffect(() => {
    fetchRows();
  }, [fetchRows]);

  const totalPages = Math.max(1, Math.ceil(total / 20));

  return (
    <div className="space-y-4">
      <Tabs value={categoryTab} onValueChange={(v) => { setCategoryTab(v as typeof categoryTab); setPage(1); }}>
        <TabsList>
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="B2B">B2B</TabsTrigger>
          <TabsTrigger value="B2C">B2C</TabsTrigger>
        </TabsList>

        <TabsContent value={categoryTab} className="mt-4 space-y-4">
          <div className="flex flex-wrap gap-3">
            <div className="relative min-w-[200px] flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Search booking, PNR, customer..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              />
            </div>
            <Select value={productType} onValueChange={(v) => { setProductType(v); setPage(1); }}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Product" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All products</SelectItem>
                <SelectItem value="FLIGHT">Flights</SelectItem>
                <SelectItem value="HOTEL">Hotels</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {loading ? (
            <div className="flex justify-center py-16 text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : rows.length === 0 ? (
            <div className="rounded-lg border border-dashed py-16 text-center text-muted-foreground">
              No cancellations found.
            </div>
          ) : (
            <div className="rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Booking</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Product</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead>Net refund</TableHead>
                    <TableHead>Cancelled</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell>
                        <Link href={`/bookings/${row.booking.id}`} className="font-medium text-primary hover:underline">
                          {row.booking.publicRef}
                        </Link>
                        {row.booking.pnr && (
                          <p className="text-xs text-muted-foreground">PNR: {row.booking.pnr}</p>
                        )}
                      </TableCell>
                      <TableCell>{row.booking.customer.name}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{PRODUCT_LABELS[row.booking.productType]}</Badge>
                        <p className="mt-1 text-xs text-muted-foreground">{productDetail(row)}</p>
                      </TableCell>
                      <TableCell>
                        <Badge variant={row.category === "B2B" ? "default" : "secondary"}>
                          {row.category}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate text-sm">{row.reason}</TableCell>
                      <TableCell>{formatCurrency(refundDisplay(row))}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDateTime(row.cancelledAt)}
                        {row.cancelledBy && (
                          <p className="text-xs">by {row.cancelledBy.name}</p>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {total > 0 && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                {total} cancellation{total !== 1 ? "s" : ""}
              </p>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm text-muted-foreground">
                  Page {page} of {totalPages}
                </span>
                <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
