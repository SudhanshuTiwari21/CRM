import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StatusBadge } from "@/components/booking/status-badge";
import { ConfirmPnrDialog } from "@/components/booking/confirm-pnr-dialog";
import { AdminBookingToolbar } from "@/components/booking/admin-booking-toolbar";
import { SendItineraryDialog } from "@/components/booking/send-itinerary-dialog";
import { BookingQuickActions } from "@/components/booking/booking-quick-actions";
import { CHANNEL_LABELS, PRODUCT_LABELS } from "@/lib/constants";
import { formatCurrency, formatDateTime, formatDate } from "@/lib/utils";
import type { FlightSegment, FlightPassenger, HotelGuest, BusPassenger } from "@/types/booking";
import { buildSectorSummary, connectionGapText, connectionGapTitle, itineraryBadgeLabel } from "@/lib/flight-layover";
import { ArrowLeft } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default async function BookingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const booking = await prisma.booking.findUnique({
    where: { id },
    include: {
      customer: true,
      assignedAgent: { select: { name: true, email: true } },
      flightBooking: true,
      hotelBooking: true,
      busBooking: true,
      payments: true,
      documents: true,
      emailLogs: { orderBy: { createdAt: "desc" } },
      whatsappLogs: { orderBy: { createdAt: "desc" } },
      activityLogs: {
        include: { user: { select: { name: true } } },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!booking) notFound();

  const agents = await prisma.user.findMany({
    where: { active: true },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  const isHotel = booking.productType === "HOTEL";
  const isFlight = booking.productType === "FLIGHT";
  const isRoundTrip = booking.flightBooking?.tripType === "ROUND_TRIP";
  const canConfirmPnr =
    ["PROCESSING", "FAILED"].includes(booking.status) ||
    (booking.status === "CONFIRMED" && booking.documents.length === 0) ||
    (isHotel && booking.status === "TICKET_SENT" && !booking.hotelBooking?.confirmationNo);

  return (
    <div>
      <div className="mb-4">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/bookings">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Bookings
          </Link>
        </Button>
      </div>

      <Header
        title={booking.publicRef}
        description={`${PRODUCT_LABELS[booking.productType]} • ${CHANNEL_LABELS[booking.channel]}`}
        actions={
          <div className="flex flex-wrap gap-2">
            <BookingQuickActions bookingId={booking.id} agents={agents} />
            {canConfirmPnr && (
              <ConfirmPnrDialog
                bookingId={booking.id}
                existingPnr={booking.hotelBooking?.confirmationNo || booking.pnr}
                isRoundTrip={isRoundTrip}
                resume={booking.status === "CONFIRMED" && booking.documents.length === 0}
                isHotel={isHotel}
                hotelPendingSupplier={isHotel && !booking.hotelBooking?.confirmationNo}
              />
            )}
            {isFlight && booking.status === "PROCESSING" && (
              <SendItineraryDialog bookingId={booking.id} isRoundTrip={isRoundTrip} />
            )}
            <AdminBookingToolbar
              bookingId={booking.id}
              publicRef={booking.publicRef}
              productType={booking.productType}
              status={booking.status}
              pnr={booking.pnr}
              internalNotes={booking.internalNotes}
              totalAmount={Number(booking.totalAmount)}
              flight={booking.flightBooking}
            />
          </div>
        }
      />

      <div className="mb-6 flex flex-wrap gap-3">
        <StatusBadge status={booking.status} />
        {booking.pnr && <Badge variant="info">PNR: {booking.pnr}</Badge>}
        <Badge variant="outline">{formatCurrency(booking.totalAmount)}</Badge>
        <Badge variant="outline">Payment: {booking.paymentStatus}</Badge>
      </div>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="itinerary">Itinerary</TabsTrigger>
          <TabsTrigger value="passengers">Passengers</TabsTrigger>
          <TabsTrigger value="payments">Payments</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader><CardTitle className="text-base">Customer</CardTitle></CardHeader>
              <CardContent className="space-y-2 text-sm">
                <p><span className="text-muted-foreground">Name:</span> {booking.customer.name}</p>
                <p><span className="text-muted-foreground">Phone:</span> {booking.customer.phone}</p>
                <p><span className="text-muted-foreground">Email:</span> {booking.customer.email || "—"}</p>
                <Link href={`/customers/${booking.customer.id}`} className="text-primary text-sm hover:underline">
                  View customer profile →
                </Link>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-base">Booking Info</CardTitle></CardHeader>
              <CardContent className="space-y-2 text-sm">
                <p><span className="text-muted-foreground">Created:</span> {formatDateTime(booking.createdAt)}</p>
                <p><span className="text-muted-foreground">Agent:</span> {booking.assignedAgent?.name || "Unassigned"}</p>
                <p><span className="text-muted-foreground">Confirmed:</span> {booking.confirmedAt ? formatDateTime(booking.confirmedAt) : "—"}</p>
                <p><span className="text-muted-foreground">Supplier Ref:</span> {booking.supplierRef || "—"}</p>
                {booking.internalNotes && (
                  <p className="whitespace-pre-line"><span className="text-muted-foreground">Notes:</span> {booking.internalNotes}</p>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="itinerary">
          {booking.flightBooking && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  Flight — {booking.flightBooking.airline}
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  {buildSectorSummary(
                    booking.flightBooking.segments as unknown as FlightSegment[],
                    booking.flightBooking.tripType
                  )}{" "}
                  • {itineraryBadgeLabel(
                    booking.flightBooking.tripType,
                    booking.flightBooking.segments as unknown as FlightSegment[]
                  )}
                  {booking.flightBooking.checkInAssistance && (
                    <span className="ml-2 inline-flex rounded-full bg-violet-100 px-2 py-0.5 text-xs font-medium text-violet-800 dark:bg-violet-950 dark:text-violet-200">
                      Check-in assistance
                    </span>
                  )}
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                {(booking.flightBooking.segments as unknown as FlightSegment[]).map((seg, i, arr) => (
                  <div key={i} className="space-y-3">
                    <div className="rounded-lg border p-4">
                      <p className="font-medium">
                        {seg.flightNumber}
                        {seg.aircraft ? ` • ${seg.aircraft}` : ""}
                      </p>
                      <p className="mt-2 text-sm">
                        {seg.fromCity} ({seg.fromAirport}) → {seg.toCity} ({seg.toAirport})
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {formatDateTime(seg.departureAt)} — {formatDateTime(seg.arrivalAt)}
                      </p>
                      {(seg.departureTerminal || seg.terminal) && (
                        <p className="text-xs text-muted-foreground mt-1">
                          {seg.departureTerminal && `Dep: ${seg.departureTerminal}`}
                          {seg.departureTerminal && seg.terminal && " • "}
                          {seg.terminal && `Arr: ${seg.terminal}`}
                        </p>
                      )}
                    </div>
                    {i < arr.length - 1 && (
                      <div className="ml-6 rounded-lg border border-dashed border-amber-300 bg-amber-50/50 px-4 py-3 text-sm dark:border-amber-700 dark:bg-amber-950/20">
                        <p className="font-medium text-amber-900 dark:text-amber-100">
                          {connectionGapTitle(booking.flightBooking!.tripType, i)}
                        </p>
                        <p className="text-muted-foreground">
                          {connectionGapText(seg, arr[i + 1], booking.flightBooking!.tripType, i)}
                        </p>
                      </div>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
          {booking.hotelBooking && (
            <Card>
              <CardHeader><CardTitle className="text-base">{booking.hotelBooking.propertyName}</CardTitle></CardHeader>
              <CardContent className="space-y-2 text-sm">
                <p>{booking.hotelBooking.propertyAddress}</p>
                <p>Check-in: {formatDate(booking.hotelBooking.checkIn)}</p>
                <p>Check-out: {formatDate(booking.hotelBooking.checkOut)}</p>
                <p>Nights: {booking.hotelBooking.nights} • Room: {booking.hotelBooking.roomType}</p>
                {booking.hotelBooking.confirmationNo && <p>Confirmation: {booking.hotelBooking.confirmationNo}</p>}
              </CardContent>
            </Card>
          )}
          {booking.busBooking && (
            <Card>
              <CardHeader><CardTitle className="text-base">{booking.busBooking.operator}</CardTitle></CardHeader>
              <CardContent className="space-y-2 text-sm">
                <p>Route: {booking.busBooking.route}</p>
                <p>Boarding: {booking.busBooking.boardingPoint}</p>
                <p>Dropping: {booking.busBooking.droppingPoint}</p>
                <p>Departure: {formatDateTime(booking.busBooking.departureAt)}</p>
                <p>Arrival: {formatDateTime(booking.busBooking.arrivalAt)}</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="passengers">
          <Card>
            <CardContent className="pt-6">
              {booking.flightBooking && (
                <div className="space-y-3">
                  {(booking.flightBooking.passengers as unknown as FlightPassenger[]).map((p, i) => (
                    <div key={i} className="flex items-center justify-between rounded-lg border p-3">
                      <div>
                        <p className="font-medium">{p.title} {p.firstName} {p.lastName}</p>
                        <p className="text-sm text-muted-foreground">{p.gender}</p>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        Seat: {p.seat || "—"} | Baggage: {p.checkInBaggage || "15 KG"}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {booking.hotelBooking && (
                <div className="space-y-3">
                  {(booking.hotelBooking.guests as unknown as HotelGuest[]).map((g, i) => (
                    <div key={i} className="rounded-lg border p-3">
                      <p className="font-medium">{g.name}</p>
                      <p className="text-sm text-muted-foreground capitalize">{g.type}</p>
                    </div>
                  ))}
                </div>
              )}
              {booking.busBooking && (
                <div className="space-y-3">
                  {(booking.busBooking.passengers as unknown as BusPassenger[]).map((p, i) => (
                    <div key={i} className="flex justify-between rounded-lg border p-3">
                      <p className="font-medium">{p.name}</p>
                      <p className="text-sm text-muted-foreground">Seat {p.seat}</p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="payments">
          <Card>
            <CardContent className="pt-6 space-y-4">
              {booking.flightBooking?.baseFare != null && (
                <div className="rounded-lg border p-4 text-sm space-y-2">
                  <p className="font-medium">
                    Invoice: {booking.flightBooking.invoiceTaxType === "ITC" ? "ITC (B2B)" : "Non-ITC (B2C)"}
                  </p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <p><span className="text-muted-foreground">Base Fare:</span> {formatCurrency(Number(booking.flightBooking.baseFare))}</p>
                    <p><span className="text-muted-foreground">Service Charge:</span> {formatCurrency(Number(booking.flightBooking.serviceCharge || 0))}</p>
                    {Number(booking.flightBooking.cgstAmount) > 0 && (
                      <p><span className="text-muted-foreground">CGST ({Number(booking.flightBooking.cgstRate)}%):</span> {formatCurrency(Number(booking.flightBooking.cgstAmount))}</p>
                    )}
                    {Number(booking.flightBooking.sgstAmount) > 0 && (
                      <p><span className="text-muted-foreground">SGST ({Number(booking.flightBooking.sgstRate)}%):</span> {formatCurrency(Number(booking.flightBooking.sgstAmount))}</p>
                    )}
                    {Number(booking.flightBooking.igstAmount) > 0 && (
                      <p><span className="text-muted-foreground">IGST ({Number(booking.flightBooking.igstRate)}%):</span> {formatCurrency(Number(booking.flightBooking.igstAmount))}</p>
                    )}
                    {booking.flightBooking.buyerGstin && (
                      <p className="sm:col-span-2"><span className="text-muted-foreground">Buyer GSTIN:</span> {booking.flightBooking.buyerGstin}</p>
                    )}
                  </div>
                </div>
              )}
              {booking.payments.length === 0 ? (
                <p className="text-muted-foreground">No payments recorded</p>
              ) : (
                booking.payments.map((p) => (
                  <div key={p.id} className="flex justify-between rounded-lg border p-3">
                    <div>
                      <p className="font-medium">{formatCurrency(p.amount)}</p>
                      <p className="text-sm text-muted-foreground">{p.method} • {p.status}</p>
                    </div>
                    <p className="text-sm text-muted-foreground">{formatDateTime(p.paidAt)}</p>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="documents">
          <Card>
            <CardContent className="pt-6">
              {booking.documents.length === 0 ? (
                <p className="text-muted-foreground">No documents generated yet. Confirm PNR to generate.</p>
              ) : (
                <div className="space-y-2">
                  {booking.documents.map((doc) => (
                    <div key={doc.id} className="flex items-center justify-between rounded-lg border p-3">
                      <div>
                        <p className="font-medium">{doc.type}</p>
                        <p className="text-sm text-muted-foreground">{doc.fileName}</p>
                      </div>
                      <Button variant="outline" size="sm" asChild>
                        <a href={`/api/documents/${doc.id}`} target="_blank" rel="noopener noreferrer">
                          View PDF
                        </a>
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="activity">
          <Card>
            <CardContent className="pt-6">
              <div className="space-y-4">
                {booking.activityLogs.map((log) => (
                  <div key={log.id} className="flex gap-3 border-l-2 border-primary/30 pl-4">
                    <div>
                      <p className="font-medium text-sm">{log.action.replace(/_/g, " ")}</p>
                      <p className="text-xs text-muted-foreground">
                        {log.user?.name || "System"} • {formatDateTime(log.createdAt)}
                      </p>
                    </div>
                  </div>
                ))}
                {booking.emailLogs.map((email) => (
                  <div key={email.id} className="flex gap-3 border-l-2 border-emerald-300 pl-4">
                    <div>
                      <p className="font-medium text-sm">Email: {email.template}</p>
                      <p className="text-xs text-muted-foreground">
                        To: {email.to} • {email.status} • {email.sentAt ? formatDateTime(email.sentAt) : "Pending"}
                      </p>
                    </div>
                  </div>
                ))}
                {booking.whatsappLogs.map((wa) => (
                  <div key={wa.id} className="flex gap-3 border-l-2 border-green-400 pl-4">
                    <div>
                      <p className="font-medium text-sm">WhatsApp: {wa.template}</p>
                      <p className="text-xs text-muted-foreground">
                        To: {wa.to} • {wa.status} • {wa.sentAt ? formatDateTime(wa.sentAt) : "Pending"}
                      </p>
                      {wa.error && <p className="text-xs text-destructive">{wa.error}</p>}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
