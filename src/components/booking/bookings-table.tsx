"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  createColumnHelper,
} from "@tanstack/react-table";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatusBadge } from "@/components/booking/status-badge";
import { Badge } from "@/components/ui/badge";
import { CHANNEL_LABELS, PRODUCT_LABELS } from "@/lib/constants";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import type { BookingStatus, BookingChannel, ProductType } from "@prisma/client";
import type { FlightPassenger } from "@/types/booking";
import { freqFlyerStatusLabel } from "@/lib/frequent-flyer";
import { specialAssistanceStatusLabel } from "@/lib/special-assistance";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import { parseApiResponse } from "@/lib/parse-api-response";

interface BookingRow {
  id: string;
  publicRef: string;
  pnr: string | null;
  status: BookingStatus;
  channel: BookingChannel;
  productType: ProductType;
  totalAmount: string | number;
  createdAt: string;
  customer: { name: string; phone: string };
  assignedAgent?: { name: string } | null;
  flightBooking?: {
    freqFlyerUpdatedToAirline: boolean;
    specialAssistanceUpdatedToAirline: boolean;
    passengers: unknown;
  } | null;
}

const columnHelper = createColumnHelper<BookingRow>();

const columns = [
  columnHelper.accessor("publicRef", {
    header: "Booking ID",
    cell: (info) => (
      <Link href={`/bookings/${info.row.original.id}`} className="font-medium text-primary hover:underline">
        {info.getValue()}
      </Link>
    ),
  }),
  columnHelper.accessor("customer.name", { header: "Customer" }),
  columnHelper.accessor("productType", {
    header: "Product",
    cell: (info) => <Badge variant="outline">{PRODUCT_LABELS[info.getValue()]}</Badge>,
  }),
  columnHelper.accessor("channel", {
    header: "Channel",
    cell: (info) => <span className="text-sm text-muted-foreground">{CHANNEL_LABELS[info.getValue()]}</span>,
  }),
  columnHelper.accessor("pnr", {
    header: "PNR",
    cell: (info) => info.getValue() || <span className="text-muted-foreground">-</span>,
  }),
  columnHelper.accessor("status", {
    header: "Status",
    cell: (info) => <StatusBadge status={info.getValue()} />,
  }),
  columnHelper.display({
    id: "freqFlyerUpdated",
    header: "FF Updated to Airline",
    cell: ({ row }) => {
      const fb = row.original.flightBooking;
      if (!fb || row.original.productType !== "FLIGHT") {
        return <span className="text-muted-foreground">-</span>;
      }
      const passengers = (fb.passengers as FlightPassenger[]) || [];
      const status = freqFlyerStatusLabel("FLIGHT", passengers, fb.freqFlyerUpdatedToAirline);
      if (status === "na") return <span className="text-muted-foreground">-</span>;
      return (
        <Badge variant={status === "yes" ? "success" : "warning"} className="font-normal">
          {status === "yes" ? "Yes" : "No"}
        </Badge>
      );
    },
  }),
  columnHelper.display({
    id: "specialAssistanceUpdated",
    header: "Assistance Updated",
    cell: ({ row }) => {
      const fb = row.original.flightBooking;
      if (!fb || row.original.productType !== "FLIGHT") {
        return <span className="text-muted-foreground">-</span>;
      }
      const passengers = (fb.passengers as FlightPassenger[]) || [];
      const status = specialAssistanceStatusLabel(
        "FLIGHT",
        passengers,
        fb.specialAssistanceUpdatedToAirline
      );
      if (status === "na") return <span className="text-muted-foreground">-</span>;
      return (
        <Badge variant={status === "yes" ? "success" : "warning"} className="font-normal">
          {status === "yes" ? "Yes" : "No"}
        </Badge>
      );
    },
  }),
  columnHelper.accessor("totalAmount", {
    header: "Amount",
    cell: (info) => formatCurrency(info.getValue()),
  }),
  columnHelper.accessor("createdAt", {
    header: "Created",
    cell: (info) => <span className="text-sm text-muted-foreground">{formatDateTime(info.getValue())}</span>,
  }),
];

export function BookingsTable() {
  const searchParams = useSearchParams();
  const [data, setData] = useState<BookingRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState(searchParams.get("search") || "");
  const [status, setStatus] = useState(searchParams.get("status") || "all");
  const [channel, setChannel] = useState(searchParams.get("channel") || "all");
  const [productType, setProductType] = useState(searchParams.get("productType") || "all");

  const fetchBookings = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: "20" });
    if (search) params.set("search", search);
    if (status !== "all") params.set("status", status);
    if (channel !== "all") params.set("channel", channel);
    if (productType !== "all") params.set("productType", productType);

    const res = await fetch(`/api/crm/bookings?${params}`);
    const { ok, data: json } = await parseApiResponse(res);
    if (ok) {
      setData((json.bookings as BookingRow[]) || []);
      setTotal((json.total as number) || 0);
    } else {
      setData([]);
      setTotal(0);
    }
    setLoading(false);
  }, [page, search, status, channel, productType]);

  useEffect(() => {
    fetchBookings();
  }, [fetchBookings]);

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  const totalPages = Math.ceil(total / 20);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search by ID, PNR, name, phone..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          />
        </div>
        <Select value={status} onValueChange={(v) => { setStatus(v); setPage(1); }}>
          <SelectTrigger className="w-full sm:w-40"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="PROCESSING">Processing</SelectItem>
            <SelectItem value="CONFIRMED">Confirmed</SelectItem>
            <SelectItem value="TICKET_SENT">Ticket Sent</SelectItem>
            <SelectItem value="DRAFT">Draft</SelectItem>
            <SelectItem value="FAILED">Failed</SelectItem>
            <SelectItem value="CANCELLED">Cancelled</SelectItem>
          </SelectContent>
        </Select>
        <Select value={channel} onValueChange={(v) => { setChannel(v); setPage(1); }}>
          <SelectTrigger className="w-full sm:w-40"><SelectValue placeholder="Channel" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Channels</SelectItem>
            <SelectItem value="LIVE_API">Live API</SelectItem>
            <SelectItem value="HELD">Held</SelectItem>
            <SelectItem value="OFFLINE">Offline</SelectItem>
          </SelectContent>
        </Select>
        <Select value={productType} onValueChange={(v) => { setProductType(v); setPage(1); }}>
          <SelectTrigger className="w-full sm:w-36"><SelectValue placeholder="Product" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Products</SelectItem>
            <SelectItem value="FLIGHT">Flight</SelectItem>
            <SelectItem value="HOTEL">Hotel</SelectItem>
            <SelectItem value="BUS">Bus</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((hg) => (
              <TableRow key={hg.id}>
                {hg.headers.map((h) => (
                  <TableHead key={h.id}>
                    {flexRender(h.column.columnDef.header, h.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center text-muted-foreground">
                  Loading...
                </TableCell>
              </TableRow>
            ) : data.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center text-muted-foreground">
                  No bookings found
                </TableCell>
              </TableRow>
            ) : (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Showing {data.length} of {total} bookings
        </p>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="flex items-center px-2 text-sm">Page {page} of {totalPages || 1}</span>
          <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
