import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import type { AgencySettings, Booking, FlightBooking } from "@prisma/client";
import type { FlightPassenger, FlightSegment } from "@/types/booking";
import { format } from "date-fns";

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 9, fontFamily: "Helvetica" },
  header: { marginBottom: 20, borderBottom: "1px solid #ccc", paddingBottom: 10 },
  title: { fontSize: 16, fontWeight: "bold", color: "#1e3a8a" },
  subtitle: { fontSize: 10, color: "#666", marginTop: 4 },
  row: { flexDirection: "row", justifyContent: "space-between", marginBottom: 4 },
  section: { marginTop: 16, marginBottom: 8 },
  sectionTitle: { fontSize: 11, fontWeight: "bold", marginBottom: 8, color: "#1e3a8a" },
  table: { border: "1px solid #ddd" },
  tableHeader: { flexDirection: "row", backgroundColor: "#f1f5f9", borderBottom: "1px solid #ddd" },
  tableRow: { flexDirection: "row", borderBottom: "1px solid #eee" },
  cell: { flex: 1, padding: 6 },
  cellBold: { flex: 1, padding: 6, fontWeight: "bold" },
  pnrBox: { backgroundColor: "#eff6ff", padding: 10, marginTop: 10, borderRadius: 4 },
  footer: { position: "absolute", bottom: 30, left: 40, right: 40, fontSize: 7, color: "#888" },
});

interface Props {
  agency: AgencySettings;
  booking: Booking;
  flight: FlightBooking;
  segments: FlightSegment[];
  passengers: FlightPassenger[];
}

export function FlightTicketPDF({ agency, booking, flight, segments, passengers }: Props) {
  const segment = segments[0];

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.title}>{agency.companyName}</Text>
          <Text style={styles.subtitle}>
            {[agency.address, agency.city, agency.state, agency.pincode].filter(Boolean).join(", ")}
          </Text>
          <Text style={styles.subtitle}>
            GSTIN: {agency.gstin} | Phone: {agency.phone} | Email: {agency.email}
          </Text>
        </View>

        <Text style={{ fontSize: 14, fontWeight: "bold", marginBottom: 8 }}>E-TICKET / BOOKING CONFIRMATION</Text>

        <View style={styles.pnrBox}>
          <View style={styles.row}>
            <Text>PNR / Booking Reference: <Text style={{ fontWeight: "bold" }}>{booking.pnr || "PENDING"}</Text></Text>
            <Text>Status: CONFIRMED</Text>
          </View>
          <View style={styles.row}>
            <Text>Booking ID: {booking.publicRef}</Text>
            <Text>Airline: {flight.airline}</Text>
          </View>
          <View style={styles.row}>
            <Text>Issued: {format(booking.confirmedAt || booking.createdAt, "dd MMM yyyy HH:mm")}</Text>
            <Text>Payment: {booking.paymentStatus}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Flight Details</Text>
          <View style={styles.table}>
            <View style={styles.tableHeader}>
              <Text style={styles.cellBold}>Flight</Text>
              <Text style={styles.cellBold}>Depart</Text>
              <Text style={styles.cellBold}>Arrive</Text>
              <Text style={styles.cellBold}>Duration</Text>
            </View>
            {segments.map((seg, i) => (
              <View key={i} style={styles.tableRow}>
                <Text style={styles.cell}>{seg.flightNumber}</Text>
                <Text style={styles.cell}>
                  {seg.fromCity} ({seg.fromAirport}){"\n"}
                  {format(new Date(seg.departureAt), "HH:mm, dd MMM yyyy")}
                </Text>
                <Text style={styles.cell}>
                  {seg.toCity} ({seg.toAirport}){"\n"}
                  {format(new Date(seg.arrivalAt), "HH:mm, dd MMM yyyy")}
                  {seg.terminal ? `\n${seg.terminal}` : ""}
                </Text>
                <Text style={styles.cell}>{seg.duration || "-"}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Passenger Information</Text>
          <View style={styles.table}>
            <View style={styles.tableHeader}>
              <Text style={styles.cellBold}>Passenger</Text>
              <Text style={styles.cellBold}>Gender</Text>
              <Text style={styles.cellBold}>Seat</Text>
              <Text style={styles.cellBold}>Baggage</Text>
            </View>
            {passengers.map((pax, i) => (
              <View key={i} style={styles.tableRow}>
                <Text style={styles.cell}>
                  {pax.title} {pax.firstName} {pax.lastName}
                </Text>
                <Text style={styles.cell}>{pax.gender}</Text>
                <Text style={styles.cell}>{pax.seat || "-"}</Text>
                <Text style={styles.cell}>
                  Hand: {pax.handBaggage || "7 KG"} | Check-in: {pax.checkInBaggage || "15 KG"}
                </Text>
              </View>
            ))}
          </View>
        </View>

        {segment && (
          <View style={styles.section}>
            <Text>
              Route: {segment.fromCity} → {segment.toCity} | Aircraft: {segment.aircraft || "N/A"}
            </Text>
          </View>
        )}

        <Text style={styles.footer}>
          This is an electronically generated ticket. Please carry valid photo ID. Check-in closes 60 minutes before departure.
          All timings are local airport times. {agency.companyName} - {agency.phone}
        </Text>
      </Page>
    </Document>
  );
}
