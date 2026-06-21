import React from "react";
import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import type { AgencySettings, Booking, FlightBooking } from "@prisma/client";
import type { FlightPassenger, FlightSegment } from "@/types/booking";
import { format } from "date-fns";
import { CABIN_CLASS_OPTIONS } from "@/lib/constants/flight";
import {
  buildFullRoute,
  buildSectorLegs,
  buildSectorSummary,
  connectionGapText,
  connectionGapTitle,
  formatFlightDateTime,
  formatSegmentDuration,
  itineraryBadgeLabel,
} from "@/lib/flight-layover";

const styles = StyleSheet.create({
  page: { padding: 36, fontSize: 9, fontFamily: "Helvetica", color: "#111" },
  header: { marginBottom: 16, borderBottom: "2px solid #1e3a8a", paddingBottom: 12 },
  title: { fontSize: 18, fontWeight: "bold", color: "#1e3a8a" },
  subtitle: { fontSize: 8.5, color: "#444", marginTop: 3, lineHeight: 1.35 },
  badgeRow: { flexDirection: "row", gap: 8, marginTop: 10, flexWrap: "wrap" },
  badge: { backgroundColor: "#eff6ff", padding: "4 8", borderRadius: 3, fontSize: 8, color: "#1e40af" },
  pnrBox: { backgroundColor: "#f8fafc", border: "1px solid #cbd5e1", padding: 12, marginTop: 12, borderRadius: 4 },
  row: { flexDirection: "row", justifyContent: "space-between", marginBottom: 4 },
  section: { marginTop: 14 },
  sectionTitle: { fontSize: 10, fontWeight: "bold", marginBottom: 8, color: "#1e3a8a", textTransform: "uppercase" },
  routeBannerAlt: {
    backgroundColor: "#1e3a8a",
    color: "#fff",
    padding: 8,
    borderRadius: 4,
    marginBottom: 4,
    fontSize: 10,
    fontWeight: "bold",
    textAlign: "center",
  },
  sectorRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    padding: "4 8",
    borderBottom: "1px solid #e2e8f0",
    fontSize: 8,
  },
  flightCard: { border: "1px solid #e2e8f0", borderRadius: 4, marginBottom: 6, overflow: "hidden" },
  flightHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    backgroundColor: "#f1f5f9",
    padding: "6 10",
    borderBottom: "1px solid #e2e8f0",
  },
  flightBody: { flexDirection: "row", padding: 10 },
  legCol: { flex: 1 },
  legTime: { fontSize: 12, fontWeight: "bold", marginBottom: 2 },
  legCity: { fontSize: 9, color: "#334155" },
  legMeta: { fontSize: 7.5, color: "#64748b", marginTop: 2 },
  arrowCol: { width: 40, alignItems: "center", justifyContent: "center" },
  arrow: { fontSize: 14, color: "#64748b" },
  layoverBox: {
    backgroundColor: "#fffbeb",
    border: "1px dashed #f59e0b",
    padding: "8 12",
    marginBottom: 6,
    borderRadius: 4,
  },
  layoverTitle: { fontSize: 8, fontWeight: "bold", color: "#b45309", marginBottom: 2 },
  layoverText: { fontSize: 8, color: "#78350f", lineHeight: 1.4 },
  table: { border: "1px solid #e2e8f0" },
  tableHeader: { flexDirection: "row", backgroundColor: "#f1f5f9", borderBottom: "1px solid #e2e8f0" },
  tableRow: { flexDirection: "row", borderBottom: "1px solid #f1f5f9" },
  cell: { flex: 1, padding: 6, fontSize: 8 },
  cellBold: { flex: 1, padding: 6, fontSize: 8, fontWeight: "bold" },
  footer: { position: "absolute", bottom: 28, left: 36, right: 36, fontSize: 7, color: "#64748b", lineHeight: 1.4 },
});

function cabinLabel(value?: string | null) {
  return CABIN_CLASS_OPTIONS.find((c) => c.value === value)?.label || value || "Economy";
}

interface Props {
  agency: AgencySettings;
  booking: Booking;
  flight: FlightBooking;
  segments: FlightSegment[];
  passengers: FlightPassenger[];
}

export function FlightTicketPDF({ agency, booking, flight, segments, passengers }: Props) {
  const route = buildFullRoute(segments);
  const sectorSummary = buildSectorSummary(segments, flight.tripType);
  const sectorLegs = buildSectorLegs(segments, flight.tripType);
  const tripBadge = itineraryBadgeLabel(flight.tripType, segments);

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.title}>{agency.companyName}</Text>
          <Text style={styles.subtitle}>
            {[agency.address, agency.city, agency.state, agency.pincode].filter(Boolean).join(", ")}
          </Text>
          <Text style={styles.subtitle}>
            {[agency.gstin && `GSTIN: ${agency.gstin}`, agency.phone && `Tel: ${agency.phone}`, agency.email]
              .filter(Boolean)
              .join(" | ")}
          </Text>
        </View>

        <Text style={{ fontSize: 13, fontWeight: "bold", marginBottom: 4 }}>E-TICKET / BOOKING CONFIRMATION</Text>

        <View style={styles.pnrBox}>
          <View style={styles.row}>
            <Text>
              PNR: <Text style={{ fontWeight: "bold" }}>{booking.pnr || "PENDING"}</Text>
            </Text>
            <Text>Status: CONFIRMED</Text>
          </View>
          <View style={styles.row}>
            <Text>Booking ID: {booking.publicRef}</Text>
            <Text>Airline: {flight.airline}</Text>
          </View>
          {flight.secondaryPnr && (
            <View style={styles.row}>
              <Text>Return PNR: {flight.secondaryPnr}</Text>
            </View>
          )}
          <View style={styles.row}>
            <Text>Issued: {format(booking.confirmedAt || booking.createdAt, "dd MMM yyyy HH:mm")}</Text>
            <Text>Class: {cabinLabel(flight.cabinClass)}</Text>
          </View>
        </View>

        <View style={styles.badgeRow}>
          <Text style={styles.badge}>{tripBadge}</Text>
          <Text style={styles.badge}>{sectorSummary}</Text>
          <Text style={styles.badge}>{passengers.length} Passenger(s)</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Itinerary</Text>

          {flight.tripType === "ROUND_TRIP" && segments.length >= 2 ? (
            <View style={{ marginBottom: 8 }}>
              {sectorLegs.map((leg, i) => (
                <Text key={i} style={styles.routeBannerAlt}>
                  {leg.label}: {leg.cities} ({leg.sector}){leg.date ? ` • ${leg.date}` : ""}
                </Text>
              ))}
            </View>
          ) : route ? (
            <Text style={styles.routeBannerAlt}>{route}</Text>
          ) : null}

          <View style={[styles.table, { marginBottom: 8 }]}>
            <View style={styles.tableHeader}>
              <Text style={[styles.cellBold, { flex: 0.8 }]}>Leg</Text>
              <Text style={styles.cellBold}>Sector</Text>
              <Text style={styles.cellBold}>Flight</Text>
              <Text style={styles.cellBold}>Date</Text>
            </View>
            {sectorLegs.map((leg, i) => (
              <View key={i} style={styles.sectorRow}>
                <Text style={{ flex: 0.8, fontWeight: "bold" }}>{leg.label}</Text>
                <Text style={{ flex: 1 }}>{leg.sector}</Text>
                <Text style={{ flex: 1 }}>{leg.flight || "—"}</Text>
                <Text style={{ flex: 1 }}>{leg.date || "—"}</Text>
              </View>
            ))}
          </View>

          {segments.map((seg, i) => (
            <React.Fragment key={i}>
              <View style={styles.flightCard}>
                <View style={styles.flightHeader}>
                  <Text style={{ fontWeight: "bold", fontSize: 9 }}>
                    {seg.direction === "return"
                      ? "Return"
                      : seg.direction === "outbound"
                        ? "Outbound"
                        : `Flight ${i + 1}`}{" "}
                    — {seg.flightNumber || "—"}
                  </Text>
                  <Text style={{ fontSize: 8, color: "#64748b" }}>
                    Duration: {formatSegmentDuration(seg)}
                    {seg.aircraft ? ` • ${seg.aircraft}` : ""}
                  </Text>
                </View>
                <View style={styles.flightBody}>
                  <View style={styles.legCol}>
                    <Text style={styles.legTime}>{formatFlightDateTime(seg.departureAt).split(",")[0]}</Text>
                    <Text style={styles.legCity}>
                      {seg.fromCity} ({seg.fromAirport})
                    </Text>
                    <Text style={styles.legMeta}>
                      {formatFlightDateTime(seg.departureAt)}
                      {seg.departureTerminal ? `\nDep Terminal: ${seg.departureTerminal}` : ""}
                    </Text>
                  </View>
                  <View style={styles.arrowCol}>
                    <Text style={styles.arrow}>→</Text>
                  </View>
                  <View style={styles.legCol}>
                    <Text style={styles.legTime}>{formatFlightDateTime(seg.arrivalAt).split(",")[0]}</Text>
                    <Text style={styles.legCity}>
                      {seg.toCity} ({seg.toAirport})
                    </Text>
                    <Text style={styles.legMeta}>
                      {formatFlightDateTime(seg.arrivalAt)}
                      {seg.terminal ? `\nArr Terminal: ${seg.terminal}` : ""}
                    </Text>
                  </View>
                </View>
              </View>

              {i < segments.length - 1 && (
                <View style={styles.layoverBox}>
                  <Text style={styles.layoverTitle}>
                    {connectionGapTitle(flight.tripType, i)}
                  </Text>
                  <Text style={styles.layoverText}>
                    {connectionGapText(seg, segments[i + 1], flight.tripType, i)}
                  </Text>
                </View>
              )}
            </React.Fragment>
          ))}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Passenger Information</Text>
          <View style={styles.table}>
            <View style={styles.tableHeader}>
              <Text style={styles.cellBold}>Passenger</Text>
              <Text style={styles.cellBold}>Type</Text>
              <Text style={styles.cellBold}>Seat</Text>
              <Text style={styles.cellBold}>Baggage</Text>
            </View>
            {passengers.map((pax, i) => (
              <View key={i} style={styles.tableRow}>
                <Text style={styles.cell}>
                  {pax.title} {pax.firstName} {pax.lastName}
                  {pax.ticketNumber ? `\nE-Ticket: ${pax.ticketNumber}` : ""}
                </Text>
                <Text style={styles.cell}>{pax.paxType || "adult"}</Text>
                <Text style={styles.cell}>{pax.seat || "—"}</Text>
                <Text style={styles.cell}>
                  Hand: {pax.handBaggage || "7 KG"} | Check-in: {pax.checkInBaggage || "15 KG"}
                </Text>
              </View>
            ))}
          </View>
        </View>

        <Text style={styles.footer}>
          This is an electronically generated ticket. Please carry valid photo ID. Check-in closes 60 minutes before
          departure. All timings are local airport times. For multi-stop itineraries, allow sufficient layover time
          between connections. {agency.companyName} — {agency.phone || agency.email || ""}
        </Text>
      </Page>
    </Document>
  );
}
