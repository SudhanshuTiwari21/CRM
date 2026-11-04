"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/booking/status-badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatDateTime } from "@/lib/utils";
import { buildSectorSummary } from "@/lib/flight-layover";
import type { FlightSegment } from "@/types/booking";
import type { BookingStatus } from "@prisma/client";
import { BellRing, Building2, Clock, Headphones, Loader2, Plane } from "lucide-react";
import { parseApiResponse } from "@/lib/parse-api-response";

interface UpcomingFlightRow {
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

interface UpcomingHotelRow {
  id: string;
  publicRef: string;
  pnr: string | null;
  status: BookingStatus;
  customer: { name: string; phone: string };
  assignedAgent?: { name: string } | null;
  propertyName: string;
  city: string | null;
  confirmationNo: string | null;
  roomType: string;
  roomsCount: number;
  adultsCount: number;
  childrenCount: number;
  checkInTime: string;
  checkOut: string;
  checkInAt: string;
  extraServicesOpted: boolean;
  extraServicesNotes: string | null;
  extraServicesNotifiedToHotel: boolean;
  extraServicesNotifiedAt: string | null;
}

function hoursUntil(iso: string | null) {
  if (!iso) return null;
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return null;
  return Math.round(ms / (1000 * 60 * 60));
}

export function Upcoming48hTable() {
  const [flights, setFlights] = useState<UpcomingFlightRow[]>([]);
  const [hotels, setHotels] = useState<UpcomingHotelRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("flights");
  const [notifyingId, setNotifyingId] = useState<string | null>(null);

  const fetchRows = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/crm/bookings/upcoming-48h");
    const { ok, data } = await parseApiResponse(res);
    if (ok) {
      setFlights((data.flights as UpcomingFlightRow[]) || (data.bookings as UpcomingFlightRow[]) || []);
      setHotels((data.hotels as UpcomingHotelRow[]) || []);
    } else {
      setFlights([]);
      setHotels([]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchRows();
  }, [fetchRows]);

  const assistanceCount = flights.filter((r) => r.checkInAssistance).length;
  const extraServicesCount = hotels.filter((r) => r.extraServicesOpted).length;

  async function toggleExtraServicesNotified(row: UpcomingHotelRow, notified: boolean) {
    setNotifyingId(row.id);
    try {
      const res = await fetch(`/api/crm/bookings/${row.id}/extra-services`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ extraServicesNotifiedToHotel: notified }),
      });
      const { ok, error } = await parseApiResponse(res);
      if (!ok) throw new Error(error || "Update failed");
      setHotels((prev) =>
        prev.map((h) =>
          h.id === row.id
            ? {
                ...h,
                extraServicesNotifiedToHotel: notified,
                extraServicesNotifiedAt: notified ? new Date().toISOString() : null,
              }
            : h
        )
      );
      toast.success(notified ? "Marked as notified to hotel" : "Marked as not notified");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Update failed");
    } finally {
      setNotifyingId(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3">
        <Badge variant="outline" className="gap-1 py-1">
          <Plane className="h-3 w-3" />
          {flights.length} flights departing
        </Badge>
        <Badge variant="outline" className="gap-1 py-1">
          <Building2 className="h-3 w-3" />
          {hotels.length} hotel check-ins
        </Badge>
        <Badge variant="secondary" className="gap-1 py-1">
          <Headphones className="h-3 w-3" />
          {assistanceCount} check-in assistance
        </Badge>
        <Badge variant="secondary" className="gap-1 py-1">
          <BellRing className="h-3 w-3" />
          {extraServicesCount} extra services
        </Badge>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="flights" className="gap-1.5">
            <Plane className="h-3.5 w-3.5" />
            Flights ({flights.length})
          </TabsTrigger>
          <TabsTrigger value="hotels" className="gap-1.5">
            <Building2 className="h-3.5 w-3.5" />
            Hotels ({hotels.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="flights" className="mt-4">
          {loading ? (
            <div className="flex justify-center py-16 text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : flights.length === 0 ? (
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
                  {flights.map((row) => {
                    const hrs = hoursUntil(row.departureAt);
                    const sector = buildSectorSummary(row.segments, row.tripType);
                    return (
                      <TableRow key={row.id}>
                        <TableCell>
                          <Link
                            href={`/bookings/${row.id}`}
                            className="font-medium text-primary hover:underline"
                          >
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
                          <p className="text-sm">
                            {row.departureAt ? formatDateTime(row.departureAt) : "-"}
                          </p>
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
        </TabsContent>

        <TabsContent value="hotels" className="mt-4">
          {loading ? (
            <div className="flex justify-center py-16 text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : hotels.length === 0 ? (
            <div className="rounded-lg border border-dashed py-16 text-center text-muted-foreground">
              No hotel bookings checking in within the next 48 hours.
            </div>
          ) : (
            <div className="rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Booking</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Hotel</TableHead>
                    <TableHead>Check-in</TableHead>
                    <TableHead>Stay</TableHead>
                    <TableHead>Extra services</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {hotels.map((row) => {
                    const hrs = hoursUntil(row.checkInAt);
                    const notifying = notifyingId === row.id;
                    return (
                      <TableRow key={row.id}>
                        <TableCell>
                          <Link
                            href={`/bookings/${row.id}`}
                            className="font-medium text-primary hover:underline"
                          >
                            {row.publicRef}
                          </Link>
                          <p className="text-xs text-muted-foreground">
                            Conf: {row.confirmationNo || row.pnr || "-"}
                          </p>
                        </TableCell>
                        <TableCell>
                          <p>{row.customer.name}</p>
                          <p className="text-xs text-muted-foreground">{row.customer.phone}</p>
                        </TableCell>
                        <TableCell>
                          <p className="text-sm">{row.propertyName}</p>
                          <p className="text-xs text-muted-foreground">
                            {[row.city, row.roomType].filter(Boolean).join(" · ")}
                          </p>
                        </TableCell>
                        <TableCell>
                          <p className="text-sm">{formatDateTime(row.checkInAt)}</p>
                          <p className="text-xs text-muted-foreground">{row.checkInTime}</p>
                          {hrs !== null && (
                            <p className="mt-0.5 flex items-center gap-1 text-xs text-amber-700 dark:text-amber-400">
                              <Clock className="h-3 w-3" />
                              {hrs}h left
                            </p>
                          )}
                        </TableCell>
                        <TableCell>
                          <p className="text-sm">
                            {row.roomsCount} room{row.roomsCount !== 1 ? "s" : ""}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {row.adultsCount} adult{row.adultsCount !== 1 ? "s" : ""}
                            {row.childrenCount > 0
                              ? `, ${row.childrenCount} child${row.childrenCount !== 1 ? "ren" : ""}`
                              : ""}
                          </p>
                        </TableCell>
                        <TableCell className="min-w-[180px]">
                          {!row.extraServicesOpted ? (
                            <span className="text-muted-foreground">No</span>
                          ) : (
                            <div className="space-y-2">
                              <Badge className="bg-amber-600 hover:bg-amber-600">Yes</Badge>
                              {row.extraServicesNotes ? (
                                <p className="text-xs text-muted-foreground whitespace-pre-wrap">
                                  {row.extraServicesNotes}
                                </p>
                              ) : null}
                              <Button
                                type="button"
                                size="sm"
                                variant={row.extraServicesNotifiedToHotel ? "secondary" : "default"}
                                disabled={notifying}
                                onClick={() =>
                                  void toggleExtraServicesNotified(
                                    row,
                                    !row.extraServicesNotifiedToHotel
                                  )
                                }
                              >
                                {notifying ? (
                                  <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  <BellRing className="mr-1 h-3.5 w-3.5" />
                                )}
                                {row.extraServicesNotifiedToHotel
                                  ? "Notified to hotel"
                                  : "Mark notified"}
                              </Button>
                              {row.extraServicesNotifiedToHotel && row.extraServicesNotifiedAt ? (
                                <p className="text-xs text-muted-foreground">
                                  {formatDateTime(row.extraServicesNotifiedAt)}
                                </p>
                              ) : null}
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          <StatusBadge status={row.status} />
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
