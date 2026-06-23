import React from "react";
import { Document, Image, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import type { Booking, FlightBooking } from "@prisma/client";
import type { FlightPassenger, FlightSegment } from "@/types/booking";
import { subMinutes } from "date-fns";
import { getAirportDisplay } from "@/lib/airport-names";
import { resolveAirlineIata } from "@/lib/airline-logo";
import { formatSegmentDuration } from "@/lib/flight-layover";

const INDIGO_BLUE = "#0B3D91";

const styles = StyleSheet.create({
  page: {
    paddingTop: 28,
    paddingBottom: 36,
    paddingHorizontal: 32,
    fontSize: 9,
    fontFamily: "Helvetica",
    color: "#000",
    backgroundColor: "#fff",
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 14,
  },
  airlineLogo: { width: 88, height: 36, objectFit: "contain" as const, objectPosition: "left" as const },
  agencyName: { fontSize: 16, fontFamily: "Times-Bold", color: INDIGO_BLUE },
  bookingDate: { fontSize: 8, color: "#333", textAlign: "right", maxWidth: 180, lineHeight: 1.35 },
  rule: { borderBottomWidth: 1, borderBottomColor: "#ccc", marginBottom: 12 },
  ruleThick: { borderBottomWidth: 2, borderBottomColor: "#000", marginBottom: 14 },
  pnrRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#ddd",
  },
  pnrBlock: { flexDirection: "row", alignItems: "center", gap: 8 },
  pnrLabel: { fontSize: 9, color: "#333" },
  pnrValue: { fontSize: 14, fontFamily: "Helvetica-Bold", letterSpacing: 0.5 },
  confirmedBadge: {
    backgroundColor: "#1a8a34",
    color: "#fff",
    fontSize: 8,
    paddingVertical: 3,
    paddingHorizontal: 10,
    borderRadius: 10,
    fontFamily: "Helvetica-Bold",
  },
  paymentBlock: { alignItems: "flex-end" },
  paymentLabel: { fontSize: 9, color: "#333", marginBottom: 2 },
  paymentValue: { fontSize: 11, fontFamily: "Helvetica-Bold" },
  sectionTitle: {
    fontSize: 13,
    fontFamily: "Times-Bold",
    marginBottom: 10,
    color: "#000",
  },
  box: {
    borderWidth: 1,
    borderColor: "#000",
    borderRadius: 8,
    padding: 14,
    marginBottom: 14,
  },
  paxNameLine: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    marginBottom: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e5e5",
  },
  gridHeader: { flexDirection: "row", marginBottom: 4 },
  gridRow: { flexDirection: "row" },
  gridCol: { flex: 1 },
  gridLabel: { fontSize: 8, color: "#444", marginBottom: 3 },
  gridValue: { fontSize: 10, fontFamily: "Helvetica-Bold" },
  flightMeta: {
    textAlign: "center",
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    marginBottom: 10,
    lineHeight: 1.5,
  },
  barcodeWrap: { alignItems: "center", marginVertical: 10 },
  barcode: { width: 340, height: 72, objectFit: "contain" as const },
  routeRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginTop: 8,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "#e5e5e5",
  },
  routeCol: { width: "38%" },
  routeCenter: { width: "24%", alignItems: "center", paddingTop: 8 },
  cityName: { fontSize: 16, fontFamily: "Times-Bold", marginBottom: 4 },
  airportLine: { fontSize: 7.5, color: "#333", lineHeight: 1.35, marginBottom: 6 },
  timeLine: { fontSize: 9, fontFamily: "Helvetica-Bold" },
  travelLabel: { fontSize: 7.5, color: "#555", marginBottom: 4, textAlign: "center" },
  travelTime: { fontSize: 9, fontFamily: "Helvetica-Bold", textAlign: "center" },
  travelLine: { borderTopWidth: 1, borderTopColor: "#999", width: "100%", marginBottom: 4 },
  footerNote: {
    position: "absolute",
    bottom: 20,
    left: 32,
    right: 32,
    fontSize: 7,
    color: "#555",
    lineHeight: 1.35,
  },
});

const FLIGHT_TZ = "Asia/Kolkata";

function formatHrs(date: Date | string) {
  const d = new Date(date);
  const parts = new Intl.DateTimeFormat("en-IN", {
    timeZone: FLIGHT_TZ,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(d);
  const hour = parts.find((p) => p.type === "hour")?.value ?? "00";
  const minute = parts.find((p) => p.type === "minute")?.value ?? "00";
  return `${hour}:${minute} hrs`;
}

function formatTravelDate(date: Date | string) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: FLIGHT_TZ,
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(date));
}

function formatBookingDate(date: Date | string) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: FLIGHT_TZ,
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(date));
}

function paxTypeLabel(type?: string) {
  if (type === "child") return "Child";
  if (type === "infant") return "Infant";
  return "Adult";
}

function paymentLabel(status: string) {
  if (status === "PAID") return "Complete";
  if (status === "ON_CREDIT") return "On Credit";
  if (status === "PENDING") return "Pending";
  return status;
}

function addonsLabel(pax: FlightPassenger) {
  if (pax.meal && pax.meal !== "none") {
    return pax.meal === "veg" ? "Veg Meal" : "Non-Veg Meal";
  }
  if (pax.checkInBaggage) return pax.checkInBaggage;
  return "-";
}

function formatGender(gender: string) {
  if (!gender) return "";
  return gender.charAt(0).toUpperCase() + gender.slice(1).toLowerCase();
}

function sectorForSegment(seg: FlightSegment) {
  return `${seg.fromAirport}-${seg.toAirport}`;
}

interface Props {
  booking: Booking;
  flight: FlightBooking;
  segments: FlightSegment[];
  passengers: FlightPassenger[];
  airlineLogoSrc?: string | null;
  /** barcodes[passengerIndex][segmentIndex] */
  barcodes: string[][];
}

function FlightLegCard({ seg, barcode }: { seg: FlightSegment; barcode?: string }) {
  const from = getAirportDisplay(seg.fromAirport, seg.fromCity);
  const to = getAirportDisplay(seg.toAirport, seg.toCity);
  const travelTime = formatSegmentDuration(seg);
  const checkInClose = seg.departureAt
    ? formatHrs(subMinutes(new Date(seg.departureAt), 60))
    : "—";
  const terminalSuffix = seg.terminal ? ` (${seg.terminal})` : "";

  return (
    <View style={styles.box}>
      <Text style={styles.flightMeta}>
        • {seg.flightNumber || "—"}
        {seg.aircraft ? ` (${seg.aircraft})` : ""} • {formatTravelDate(seg.departureAt)} • Check-in/Bag
        Drop Closes: {checkInClose}
      </Text>

      {barcode ? (
        <View style={styles.barcodeWrap}>
          <Image src={barcode} style={styles.barcode} />
        </View>
      ) : null}

      <View style={styles.routeRow}>
        <View style={styles.routeCol}>
          <Text style={styles.cityName}>{from.city}</Text>
          <Text style={styles.airportLine}>{from.airportLine}</Text>
          <Text style={styles.timeLine}>
            {formatHrs(seg.departureAt)}, {formatTravelDate(seg.departureAt)}
          </Text>
        </View>

        <View style={styles.routeCenter}>
          <Text style={styles.travelLabel}>Travel Time</Text>
          <View style={styles.travelLine} />
          <Text style={styles.travelTime}>{travelTime}</Text>
        </View>

        <View style={[styles.routeCol, { alignItems: "flex-end" }]}>
          <Text style={[styles.cityName, { textAlign: "right" }]}>{to.city}</Text>
          <Text style={[styles.airportLine, { textAlign: "right" }]}>
            {to.airportLine}
            {terminalSuffix}
          </Text>
          <Text style={[styles.timeLine, { textAlign: "right" }]}>
            {formatHrs(seg.arrivalAt)}, {formatTravelDate(seg.arrivalAt)}
          </Text>
        </View>
      </View>
    </View>
  );
}

export function FlightTicketPDF({
  booking,
  flight,
  segments,
  passengers,
  airlineLogoSrc,
  barcodes,
}: Props) {
  const airlineIata = resolveAirlineIata(flight.airline) || "6E";
  const bookingDate = formatBookingDate(booking.createdAt);
  const pnr = booking.pnr || "PENDING";

  return (
    <Document>
      {passengers.map((pax, pIdx) => (
        <Page key={pIdx} size="A4" style={styles.page}>
          <View style={styles.headerRow}>
            {airlineLogoSrc ? (
              <Image src={airlineLogoSrc} style={styles.airlineLogo} />
            ) : (
              <Text style={styles.agencyName}>{flight.airline}</Text>
            )}
            <Text style={styles.bookingDate}>*Date of booking {bookingDate}</Text>
          </View>

          <View style={styles.rule} />

          <View style={styles.pnrRow}>
            <View style={styles.pnrBlock}>
              <View>
                <Text style={styles.pnrLabel}>PNR/Booking Reference</Text>
                <Text style={styles.pnrValue}>{pnr}</Text>
              </View>
              <Text style={styles.confirmedBadge}>Confirmed</Text>
            </View>
            <View style={styles.paymentBlock}>
              <Text style={styles.paymentLabel}>Payment Status</Text>
              <Text style={styles.paymentValue}>{paymentLabel(booking.paymentStatus)}</Text>
            </View>
          </View>

          <View style={styles.ruleThick} />

          <Text style={styles.sectionTitle}>Passenger Information</Text>

          <View style={styles.box}>
            <Text style={styles.paxNameLine}>
              {pax.title} {pax.firstName} {pax.lastName} {paxTypeLabel(pax.paxType)} | {formatGender(pax.gender)} |
            </Text>
            <View style={styles.gridHeader}>
              <View style={styles.gridCol}>
                <Text style={styles.gridLabel}>Sector</Text>
              </View>
              <View style={styles.gridCol}>
                <Text style={styles.gridLabel}>Seat</Text>
              </View>
              <View style={styles.gridCol}>
                <Text style={styles.gridLabel}>{airlineIata} Add-ons</Text>
              </View>
            </View>
            <View style={styles.gridRow}>
              <View style={styles.gridCol}>
                <Text style={styles.gridValue}>
                  {segments.length === 1
                    ? sectorForSegment(segments[0])
                    : segments.map(sectorForSegment).join(" / ")}
                </Text>
              </View>
              <View style={styles.gridCol}>
                <Text style={styles.gridValue}>{pax.seat || "-"}</Text>
              </View>
              <View style={styles.gridCol}>
                <Text style={styles.gridValue}>{addonsLabel(pax)}</Text>
              </View>
            </View>
          </View>

          {segments.map((seg, sIdx) => (
            <FlightLegCard key={sIdx} seg={seg} barcode={barcodes[pIdx]?.[sIdx]} />
          ))}

          <Text style={styles.footerNote}>
            *Booking date reflects in UTC (Coordinated Universal Time), all other timings mentioned are as per
            local TIME.
          </Text>
        </Page>
      ))}
    </Document>
  );
}
