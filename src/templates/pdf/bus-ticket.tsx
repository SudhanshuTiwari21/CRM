import React from "react";
import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import type { AgencySettings, Booking, BusBooking } from "@prisma/client";
import type { BusPassenger } from "@/types/booking";
import { format } from "date-fns";
import { PdfLogo } from "@/templates/pdf/pdf-logo";
import { brandUsesSquareLogo } from "@/lib/branding";

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 9, fontFamily: "Helvetica" },
  header: { marginBottom: 20, borderBottom: "1px solid #ccc", paddingBottom: 10 },
  title: { fontSize: 16, fontWeight: "bold", color: "#1e3a8a" },
  subtitle: { fontSize: 10, color: "#666", marginTop: 4 },
  section: { marginTop: 16 },
  sectionTitle: { fontSize: 11, fontWeight: "bold", marginBottom: 8, color: "#1e3a8a" },
  table: { border: "1px solid #ddd" },
  tableHeader: { flexDirection: "row", backgroundColor: "#f1f5f9", borderBottom: "1px solid #ddd" },
  tableRow: { flexDirection: "row", borderBottom: "1px solid #eee" },
  cell: { flex: 1, padding: 6 },
  cellBold: { flex: 1, padding: 6, fontWeight: "bold" },
  footer: { position: "absolute", bottom: 30, left: 40, right: 40, fontSize: 7, color: "#888" },
});

interface Props {
  agency: AgencySettings;
  booking: Booking;
  bus: BusBooking;
  passengers: BusPassenger[];
  logoSrc?: string | null;
}

export function BusTicketPDF({ agency, booking, bus, passengers, logoSrc }: Props) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          {logoSrc ? (
            <PdfLogo src={logoSrc} square={brandUsesSquareLogo(agency.companyName)} />
          ) : (
            <Text style={styles.title}>{agency.companyName}</Text>
          )}
          <Text style={styles.title}>{agency.companyName}</Text>
          <Text style={styles.subtitle}>
            {[agency.address, agency.city].filter(Boolean).join(", ")} | {agency.phone}
          </Text>
        </View>

        <Text style={{ fontSize: 14, fontWeight: "bold", marginBottom: 8 }}>BUS TICKET CONFIRMATION</Text>
        <Text>PNR: {booking.pnr || "PENDING"} | Booking ID: {booking.publicRef}</Text>
        <Text>Operator: {bus.operator} | Route: {bus.route}</Text>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Journey Details</Text>
          <Text>Boarding: {bus.boardingPoint}</Text>
          <Text>Dropping: {bus.droppingPoint}</Text>
          <Text>
            Departure: {format(bus.departureAt, "HH:mm, dd MMM yyyy")} | Arrival:{" "}
            {format(bus.arrivalAt, "HH:mm, dd MMM yyyy")}
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Passengers</Text>
          <View style={styles.table}>
            <View style={styles.tableHeader}>
              <Text style={styles.cellBold}>Name</Text>
              <Text style={styles.cellBold}>Seat</Text>
              <Text style={styles.cellBold}>Gender</Text>
            </View>
            {passengers.map((p, i) => (
              <View key={i} style={styles.tableRow}>
                <Text style={styles.cell}>{p.name}</Text>
                <Text style={styles.cell}>{p.seat}</Text>
                <Text style={styles.cell}>{p.gender || "-"}</Text>
              </View>
            ))}
          </View>
        </View>

        <Text style={styles.footer}>
          Please arrive 30 minutes before departure. Carry valid ID. {agency.companyName}
        </Text>
      </Page>
    </Document>
  );
}
