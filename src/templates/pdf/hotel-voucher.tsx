import React from "react";
import { Document, Page, Text, View, StyleSheet, Svg, Path, Rect } from "@react-pdf/renderer";
import type { AgencySettings, Booking, Customer, HotelBooking } from "@prisma/client";
import type { HotelGuest } from "@/types/booking";
import { format } from "date-fns";
import { MEAL_PLAN_LABELS } from "@/lib/constants/hotel";
import { PdfLogo } from "@/templates/pdf/pdf-logo";
import { brandUsesSquareLogo } from "@/lib/branding";
import { formatBillingAddress } from "@/lib/cash-customer";
import { formatRoomGuestNames, normalizeHotelRooms } from "@/lib/hotel-rooms";

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
  hotelTitleRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 6, marginTop: 2 },
  hotelIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 6,
    backgroundColor: "#eff6ff",
    border: "1px solid #bfdbfe",
    alignItems: "center",
    justifyContent: "center",
  },
  hotelName: { fontSize: 16, fontWeight: "bold", color: "#1e3a8a", flex: 1 },
  hotelAddress: { fontSize: 9, color: "#4b5563", lineHeight: 1.4, marginBottom: 4 },
  contactLine: { fontSize: 8, color: "#4b5563", marginBottom: 2 },
  stayRow: { flexDirection: "row", marginTop: 14, marginBottom: 14, gap: 24 },
  stayCol: { flex: 1 },
  stayLabel: { fontSize: 8, color: "#6b7280" },
  stayTime: { fontSize: 14, fontWeight: "bold", marginTop: 2 },
  stayDate: { fontSize: 9, color: "#4b5563", marginTop: 2 },
  reservationLine: { fontSize: 9, marginBottom: 10 },
  guestLine: { fontSize: 9, marginBottom: 12 },
  roomBox: { border: "1px solid #e5e7eb", borderRadius: 4, padding: 12, marginBottom: 10 },
  roomTitle: { fontSize: 10, fontWeight: "bold", marginBottom: 4 },
  roomMeta: { fontSize: 8, color: "#4b5563", marginBottom: 3 },
  roomGuests: { fontSize: 8.5, color: "#111827", marginTop: 4, lineHeight: 1.4 },
  divider: { borderTop: "1px solid #e5e7eb", marginVertical: 8 },
  sectionTitle: { fontSize: 9, fontWeight: "bold", color: "#1e3a8a", marginBottom: 6, marginTop: 8 },
  amenitiesGrid: { flexDirection: "row", flexWrap: "wrap", gap: 4 },
  amenityItem: { width: "48%", fontSize: 7.5, color: "#374151", marginBottom: 2 },
  policyText: { fontSize: 8, color: "#4b5563", lineHeight: 1.4 },
  footer: { position: "absolute", bottom: 24, left: 32, right: 32, fontSize: 7, color: "#9ca3af", textAlign: "center" },
});

function HotelBuildingIcon() {
  return (
    <Svg viewBox="0 0 24 24" width={22} height={22}>
      <Rect x="4" y="3" width="16" height="18" rx="1.5" fill="#1e40af" />
      <Rect x="7" y="6" width="3" height="2.5" fill="#dbeafe" />
      <Rect x="14" y="6" width="3" height="2.5" fill="#dbeafe" />
      <Rect x="7" y="11" width="3" height="2.5" fill="#dbeafe" />
      <Rect x="14" y="11" width="3" height="2.5" fill="#dbeafe" />
      <Path d="M10 21 V15 H14 V21" fill="#93c5fd" />
    </Svg>
  );
}

interface Props {
  agency: AgencySettings;
  booking: Booking;
  hotel: HotelBooking;
  customer: Pick<Customer, "name" | "phone" | "email" | "pan" | "gstin" | "address" | "city" | "state" | "pincode">;
  guests: HotelGuest[];
  logoSrc?: string | null;
}

export function HotelVoucherPDF({ agency, booking, hotel, customer, guests, logoSrc }: Props) {
  const rooms = normalizeHotelRooms({
    rooms: hotel.rooms,
    roomsCount: hotel.roomsCount,
    adultsCount: hotel.adultsCount,
    childrenCount: hotel.childrenCount,
    guests: guests?.length ? guests : hotel.guests,
  });
  const adults = rooms.reduce((sum, r) => sum + r.adultsCount, 0) || hotel.adultsCount || 1;
  const children = rooms.reduce((sum, r) => sum + r.childrenCount, 0) || hotel.childrenCount || 0;
  const supplierConfirmation = hotel.confirmationNo || booking.pnr || "";
  const isConfirmed = Boolean(supplierConfirmation);
  const mealPlanLabel = MEAL_PLAN_LABELS[hotel.mealPlan] || hotel.mealPlan;
  const billingAddress = formatBillingAddress(customer);

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.headerRow}>
          {logoSrc ? (
            <PdfLogo src={logoSrc} square={brandUsesSquareLogo(agency.companyName)} />
          ) : (
            <Text style={styles.agencyName}>{agency.companyName}</Text>
          )}
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
          Hotel Confirmation Number : {supplierConfirmation || "-"}
        </Text>

        {(billingAddress || customer.pan || customer.gstin) && (
          <View style={{ marginBottom: 12 }}>
            <Text style={styles.sectionTitle}>Billing Details</Text>
            <Text style={styles.guestLine}>{customer.name}</Text>
            {billingAddress ? <Text style={styles.contactLine}>{billingAddress}</Text> : null}
            {customer.gstin ? <Text style={styles.contactLine}>GSTIN: {customer.gstin}</Text> : null}
            {customer.pan ? <Text style={styles.contactLine}>PAN: {customer.pan}</Text> : null}
            {customer.phone ? <Text style={styles.contactLine}>Contact: {customer.phone}</Text> : null}
          </View>
        )}

        {hotel.city && (
          <Text style={styles.cityLine}>
            Hotel in {hotel.city} | {hotel.nights} Night{hotel.nights !== 1 ? "s" : ""}
          </Text>
        )}

        <View style={styles.hotelTitleRow}>
          <View style={styles.hotelIconWrap}>
            <HotelBuildingIcon />
          </View>
          <Text style={styles.hotelName}>{hotel.propertyName}</Text>
        </View>
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
          Reservation for - {hotel.nights} Night{hotel.nights !== 1 ? "s" : ""} | {adults} Adult{adults !== 1 ? "s" : ""}, {children} Children | {rooms.length} Room{rooms.length !== 1 ? "s" : ""}
        </Text>

        {rooms.map((room) => {
          const guestNames = formatRoomGuestNames(room);
          return (
            <View key={room.roomNumber} style={styles.roomBox} wrap={false}>
              <Text style={styles.roomTitle}>
                Room {room.roomNumber} - {hotel.roomType}
              </Text>
              <Text style={styles.roomMeta}>
                {room.adultsCount} Adult{room.adultsCount !== 1 ? "s" : ""}
                {room.childrenCount > 0
                  ? `, ${room.childrenCount} Child${room.childrenCount !== 1 ? "ren" : ""}`
                  : ""}
              </Text>
              {guestNames ? <Text style={styles.roomGuests}>Guests: {guestNames}</Text> : null}
              <View style={styles.divider} />
              <Text style={styles.roomMeta}>Meal Plan - {mealPlanLabel}</Text>
              {hotel.inclusions ? (
                <Text style={styles.roomMeta}>Inclusions - {hotel.inclusions}</Text>
              ) : null}
            </View>
          );
        })}

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
