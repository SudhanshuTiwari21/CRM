import React from "react";
import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import type { AgencySettings, Booking, HotelBooking } from "@prisma/client";
import type { HotelGuest } from "@/types/booking";
import { format } from "date-fns";
import { MEAL_PLAN_LABELS } from "@/lib/constants/hotel";
import { PdfLogo } from "@/templates/pdf/pdf-logo";

const styles = StyleSheet.create({
  page: { padding: 32, fontSize: 9, fontFamily: "Helvetica", color: "#1f2937" },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16, paddingBottom: 12, borderBottom: "1px solid #e5e7eb" },
  agencyBlock: { textAlign: "right", maxWidth: 220 },
  agencyName: { fontSize: 11, fontWeight: "bold", color: "#111827" },
  agencyLine: { fontSize: 8, color: "#4b5563", marginTop: 2 },
  metaRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10, paddingBottom: 10, borderBottom: "1px solid #e5e7eb" },
  metaCol: { flex: 1 },
  metaLabel: { fontSize: 8, color: "#6b7280" },
  metaValue: { fontSize: 10, fontWeight: "bold", marginTop: 2 },
  badge: { backgroundColor: "#dcfce7", border: "1px solid #86efac", borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4 },
  badgePending: { backgroundColor: "#fef3c7", border: "1px solid #fcd34d" },
  badgeText: { fontSize: 8, fontWeight: "bold", color: "#166534" },
  badgeTextPending: { color: "#92400e" },
  confirmLine: { fontSize: 10, marginBottom: 14, paddingBottom: 10, borderBottom: "1px solid #e5e7eb" },
  cityLine: { fontSize: 9, color: "#4b5563", marginBottom: 4 },
  hotelName: { fontSize: 16, fontWeight: "bold", color: "#1e3a8a", marginBottom: 6 },
  hotelAddress: { fontSize: 9, color: "#4b5563", lineHeight: 1.4, marginBottom: 4 },
  contactLine: { fontSize: 8, color: "#4b5563", marginBottom: 2 },
  stayRow: { flexDirection: "row", marginTop: 14, marginBottom: 14, gap: 24 },
  stayCol: { flex: 1 },
  stayLabel: { fontSize: 8, color: "#6b7280" },
  stayTime: { fontSize: 14, fontWeight: "bold", marginTop: 2 },
  stayDate: { fontSize: 9, color: "#4b5563", marginTop: 2 },
  reservationLine: { fontSize: 9, marginBottom: 4 },
  guestLine: { fontSize: 9, marginBottom: 12 },
  roomBox: { border: "1px solid #e5e7eb", borderRadius: 4, padding: 12, marginBottom: 12 },
  roomTitle: { fontSize: 10, fontWeight: "bold", marginBottom: 6 },
  roomMeta: { fontSize: 8, color: "#4b5563", marginBottom: 4 },
  divider: { borderTop: "1px solid #e5e7eb", marginVertical: 8 },
  sectionTitle: { fontSize: 9, fontWeight: "bold", color: "#1e3a8a", marginBottom: 6, marginTop: 8 },
  amenitiesGrid: { flexDirection: "row", flexWrap: "wrap", gap: 4 },
  amenityItem: { width: "48%", fontSize: 7.5, color: "#374151", marginBottom: 2 },
  policyText: { fontSize: 8, color: "#4b5563", lineHeight: 1.4 },
  footer: { position: "absolute", bottom: 24, left: 32, right: 32, fontSize: 7, color: "#9ca3af", textAlign: "center" },
});

interface Props {
  agency: AgencySettings;
  booking: Booking;
  hotel: HotelBooking;
  guests: HotelGuest[];
  logoSrc?: string | null;
}

function countGuests(guests: HotelGuest[]) {
  const adults = guests.filter((g) => g.type === "adult").length;
  const children = guests.filter((g) => g.type === "child").length;
  return { adults, children };
}

function formatGuestList(guests: HotelGuest[]) {
  if (!guests.length) return "N/A";
  const lead = guests[0];
  const others = guests.length - 1;
  return others > 0 ? `${lead.name} (Primary Guest) + ${others} Other(s)` : `${lead.name} (Primary Guest)`;
}

export function HotelVoucherPDF({ agency, booking, hotel, guests, logoSrc }: Props) {
  const { adults, children } = countGuests(guests);
  const supplierConfirmation = hotel.confirmationNo || booking.pnr || "";
  const isConfirmed = Boolean(supplierConfirmation);
  const mealPlanLabel = MEAL_PLAN_LABELS[hotel.mealPlan] || hotel.mealPlan;

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.headerRow}>
          {logoSrc ? <PdfLogo src={logoSrc} /> : <Text style={styles.agencyName}>{agency.companyName}</Text>}
          <View style={styles.agencyBlock}>
            <Text style={styles.agencyName}>{agency.companyName}</Text>
            <Text style={styles.agencyLine}>{agency.address}</Text>
            {agency.city && <Text style={styles.agencyLine}>{agency.city}{agency.state ? `, ${agency.state}` : ""}{agency.pincode ? ` - ${agency.pincode}` : ""}</Text>}
            {agency.phone && <Text style={styles.agencyLine}>Contact Number - {agency.phone}</Text>}
            {agency.email && <Text style={styles.agencyLine}>Email ID - {agency.email}</Text>}
          </View>
        </View>

        <View style={styles.metaRow}>
          <View style={styles.metaCol}>
            <Text style={styles.metaLabel}>Booking ID</Text>
            <Text style={styles.metaValue}>{booking.publicRef}</Text>
          </View>
          <View style={styles.metaCol}>
            <Text style={styles.metaLabel}>Booking Date</Text>
            <Text style={styles.metaValue}>{format(booking.createdAt, "MMM dd, yyyy")}</Text>
          </View>
          <View style={isConfirmed ? styles.badge : [styles.badge, styles.badgePending]}>
            <Text style={isConfirmed ? styles.badgeText : [styles.badgeText, styles.badgeTextPending]}>
              {isConfirmed ? "BOOKING CONFIRMED" : "BOOKING PENDING"}
            </Text>
          </View>
        </View>

        <Text style={styles.confirmLine}>
          Hotel Confirmation Number : {supplierConfirmation || "—"}
        </Text>

        {hotel.city && (
          <Text style={styles.cityLine}>
            Hotel in {hotel.city} | {hotel.nights} Night{hotel.nights !== 1 ? "s" : ""}
          </Text>
        )}

        <Text style={styles.hotelName}>{hotel.propertyName}</Text>
        <Text style={styles.hotelAddress}>{hotel.propertyAddress}</Text>
        {hotel.propertyPhone && <Text style={styles.contactLine}>Contact Number - {hotel.propertyPhone}</Text>}
        {hotel.propertyEmail && <Text style={styles.contactLine}>Email ID - {hotel.propertyEmail}</Text>}

        <View style={styles.stayRow}>
          <View style={styles.stayCol}>
            <Text style={styles.stayLabel}>Check In</Text>
            <Text style={styles.stayTime}>{hotel.checkInTime}</Text>
            <Text style={styles.stayDate}>{format(hotel.checkIn, "EEE, dd MMM yyyy")}</Text>
          </View>
          <View style={styles.stayCol}>
            <Text style={styles.stayLabel}>Check Out</Text>
            <Text style={styles.stayTime}>{hotel.checkOutTime}</Text>
            <Text style={styles.stayDate}>{format(hotel.checkOut, "EEE, dd MMM yyyy")}</Text>
          </View>
        </View>

        <Text style={styles.reservationLine}>
          Reservation for - {hotel.nights} Night{hotel.nights !== 1 ? "s" : ""} | {adults} Adult{adults !== 1 ? "s" : ""}, {children} Children | {hotel.roomsCount} Room{hotel.roomsCount !== 1 ? "s" : ""}
        </Text>
        <Text style={styles.guestLine}>{formatGuestList(guests)}</Text>

        <View style={styles.roomBox}>
          <Text style={styles.roomTitle}>Room 1 - {hotel.roomType}</Text>
          <Text style={styles.roomMeta}>{adults} Adult(s), {children} Children</Text>
          <View style={styles.divider} />
          <Text style={styles.roomMeta}>Meal Plan - {mealPlanLabel}</Text>
          {hotel.inclusions && (
            <Text style={styles.roomMeta}>Inclusions - {hotel.inclusions}</Text>
          )}
        </View>

        {hotel.roomAmenities.length > 0 && (
          <View>
            <Text style={styles.sectionTitle}>Room Type & Amenities</Text>
            <View style={styles.amenitiesGrid}>
              {hotel.roomAmenities.map((amenity) => (
                <Text key={amenity} style={styles.amenityItem}>• {amenity}</Text>
              ))}
            </View>
          </View>
        )}

        {hotel.includeCancellationPolicy && hotel.cancellationPolicy && (
          <View>
            <Text style={styles.sectionTitle}>Cancellation Policy</Text>
            <Text style={styles.policyText}>{hotel.cancellationPolicy}</Text>
          </View>
        )}

        {hotel.agentRemarks && (
          <View>
            <Text style={styles.sectionTitle}>Remarks</Text>
            <Text style={styles.policyText}>{hotel.agentRemarks}</Text>
          </View>
        )}

        <Text style={styles.footer}>
          Present photo ID at check-in. Early check-in/late check-out subject to availability. | {agency.companyName} | {agency.phone}
        </Text>
      </Page>
    </Document>
  );
}
