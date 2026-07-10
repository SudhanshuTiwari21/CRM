"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Header } from "@/components/layout/header";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/booking/status-badge";
import { formatDateTime } from "@/lib/utils";
import { buildSectorSummary } from "@/lib/flight-layover";
import type { FlightSegment } from "@/types/booking";
import type { BookingStatus } from "@prisma/client";
import { Clock, Headphones, Loader2, Plane } from "lucide-react";
import { parseApiResponse } from "@/lib/parse-api-response";

interface UpcomingRow {
  id: string;
  publicRef: string;
  pnr: string | null;
  status: BookingStatus;
  customer: { name: string; phone: string };
  assignedAgent?: { name: string } | null;
  airline?: string;
  tripType?: string | null;
  segments: FlightSegment[];
  checkInAssistance: boolean;
  checkInAssistanceNotifiedAt: string | null;
  departureAt: string | null;
}

function hoursUntil(iso: string | null) {
  if (!iso) return null;
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return null;
  return Math.round(ms / (1000 * 60 * 60));
}

export function Upcoming48hTable() {
  const [rows, setRows] = useState<UpcomingRow[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchRows = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/crm/bookings/upcoming-48h");
    const { ok, data } = await parseApiResponse(res);
    if (ok) setRows((data.bookings as UpcomingRow[]) || []);
    else setRows([]);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchRows();
  }, [fetchRows]);

  const assistanceCount = rows.filter((r) => r.checkInAssistance).length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3">
        <Badge variant="outline" className="gap-1 py-1">
          <Plane className="h-3 w-3" />
          {rows.length} departing within 48h
        </Badge>
        <Badge variant="secondary" className="gap-1 py-1">
          <Headphones className="h-3 w-3" />
          {assistanceCount} check-in assistance
        </Badge>
      </div>

      {loading ? (
        <div className="flex justify-center py-16 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-lg border border-dashed py-16 text-center text-muted-foreground">
          No flight bookings departing in the next 48 hours.
        </div>
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Booking</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Flight</TableHead>
                <TableHead>Departure</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Assistance</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => {
                const hrs = hoursUntil(row.departureAt);
                const sector = buildSectorSummary(row.segments, row.tripType);
                return (
                  <TableRow key={row.id}>
                    <TableCell>
                      <Link href={`/bookings/${row.id}`} className="font-medium text-primary hover:underline">
                        {row.publicRef}
                      </Link>
                      <p className="text-xs text-muted-foreground">PNR: {row.pnr || "-"}</p>
                    </TableCell>
                    <TableCell>
                      <p>{row.customer.name}</p>
                      <p className="text-xs text-muted-foreground">{row.customer.phone}</p>
                    </TableCell>
                    <TableCell>
                      <p className="text-sm">{row.airline}</p>
                      <p className="text-xs text-muted-foreground">{sector}</p>
                    </TableCell>
                    <TableCell>
                      <p className="text-sm">{row.departureAt ? formatDateTime(row.departureAt) : "-"}</p>
                      {hrs !== null && (
                        <p className="flex items-center gap-1 text-xs text-amber-700 dark:text-amber-400">
                          <Clock className="h-3 w-3" />
                          {hrs}h left
                        </p>
                      )}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={row.status} />
                    </TableCell>
                    <TableCell>
                      {row.checkInAssistance ? (
                        <Badge className="gap-1 bg-violet-600 hover:bg-violet-600">
                          <Headphones className="h-3 w-3" />
                          Yes
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                      {row.checkInAssistance && row.checkInAssistanceNotifiedAt && (
                        <p className="mt-1 text-xs text-muted-foreground">Alert sent</p>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
