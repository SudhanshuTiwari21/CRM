import React from "react";
import { Document, Page, Text, View, StyleSheet, Svg, Path, Rect } from "@react-pdf/renderer";
import type { AgencySettings, Booking, Customer, HotelBooking } from "@prisma/client";
import type { HotelGuest } from "@/types/booking";
import { format } from "date-fns";
import { MEAL_PLAN_LABELS } from "@/lib/constants/hotel";
import { PdfLogo } from "@/templates/pdf/pdf-logo";
import { brandUsesSquareLogo } from "@/lib/branding";
import { formatRoomGuestNames, normalizeHotelRooms } from "@/lib/hotel-rooms";
import { WINGIE_COLORS } from "@/lib/voucher-format";

const C = WINGIE_COLORS;
const HEADER_BG = "#eef2f6";
const ACCENT = "#1e3a8a";

const styles = StyleSheet.create({
  page: {
    paddingTop: 32,
    paddingBottom: 40,
    paddingHorizontal: 36,
    fontSize: 9,
    fontFamily: "Helvetica",
    color: C.navy,
    backgroundColor: "#fff",
    lineHeight: 1.45,
  },
  headerBand: {
    marginHorizontal: -36,
    marginTop: -32,
    marginBottom: 14,
    backgroundColor: HEADER_BG,
    paddingHorizontal: 36,
    paddingTop: 22,
    paddingBottom: 14,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  agencyBlock: { alignItems: "flex-end", maxWidth: 230, flexShrink: 0 },
  agencyName: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    color: C.navy,
    marginBottom: 2,
    textAlign: "right",
  },
  agencyLine: { fontSize: 7, color: C.label, lineHeight: 1.45, textAlign: "right" },

  metaRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  metaCol: { flex: 1, paddingRight: 8 },
  metaLabel: { fontSize: 7, color: C.label, marginBottom: 3, textTransform: "uppercase" },
  metaValue: { fontSize: 9, fontFamily: "Helvetica-Bold", color: C.navy },
  badgeWrap: { alignItems: "flex-end", justifyContent: "center", minWidth: 110 },
  badge: {
    backgroundColor: "#dcfce7",
    borderWidth: 1,
    borderColor: "#86efac",
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  badgePending: { backgroundColor: "#fef3c7", borderColor: "#fcd34d" },
  badgeText: { fontSize: 7.5, fontFamily: "Helvetica-Bold", color: "#166534" },
  badgeTextPending: { color: "#92400e" },

  confirmBox: {
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 4,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginBottom: 14,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  confirmLabel: { fontSize: 7.5, color: C.label },
  confirmValue: { fontSize: 11, fontFamily: "Helvetica-Bold", color: C.navy, marginTop: 2 },

  cityLine: { fontSize: 8, color: C.label, marginBottom: 8 },

  hotelCard: {
    backgroundColor: "#f0f6fb",
    borderWidth: 1,
    borderColor: "#c5d8e8",
    borderLeftWidth: 3,
    borderLeftColor: ACCENT,
    paddingVertical: 12,
    paddingHorizontal: 12,
    marginBottom: 14,
  },
  hotelTitleRow: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  hotelIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 6,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#bfdbfe",
    alignItems: "center",
    justifyContent: "center",
  },
  hotelName: { fontSize: 13, fontFamily: "Helvetica-Bold", color: ACCENT, flex: 1, lineHeight: 1.3 },
  hotelAddress: { fontSize: 8, color: C.text, marginTop: 6, lineHeight: 1.4 },
  hotelContact: { fontSize: 7.5, color: C.label, marginTop: 3 },

  stayRow: { flexDirection: "row", gap: 10, marginBottom: 12 },
  stayCard: {
    flex: 1,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 4,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: "#fff",
  },
  stayLabel: { fontSize: 7, color: C.label, textTransform: "uppercase", marginBottom: 4 },
  stayTime: { fontSize: 13, fontFamily: "Helvetica-Bold", color: C.navy },
  stayDate: { fontSize: 8, color: C.text, marginTop: 3 },

  summaryBar: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginBottom: 12,
  },
  summaryChip: {
    backgroundColor: HEADER_BG,
    borderRadius: 10,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  summaryChipText: { fontSize: 7.5, color: C.navy, fontFamily: "Helvetica-Bold" },

  roomBox: {
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 4,
    padding: 12,
    marginBottom: 10,
  },
  roomHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 6,
  },
  roomTitle: { fontSize: 10, fontFamily: "Helvetica-Bold", color: C.navy },
  roomOccupancy: { fontSize: 7.5, color: C.label },
  roomGuests: { fontSize: 8.5, color: C.text, marginBottom: 8, lineHeight: 1.4 },
  roomDivider: { borderTopWidth: 1, borderTopColor: C.border, marginBottom: 8 },
  roomMetaRow: { flexDirection: "row", marginBottom: 3 },
  roomMetaLabel: { width: 72, fontSize: 7.5, color: C.label },
  roomMetaValue: { flex: 1, fontSize: 8, color: C.text },

  sectionTitle: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    color: ACCENT,
    marginBottom: 8,
    marginTop: 6,
  },
  amenitiesGrid: { flexDirection: "row", flexWrap: "wrap", marginBottom: 8 },
  amenityItem: {
    width: "33%",
    fontSize: 7.5,
    color: C.text,
    marginBottom: 4,
    paddingRight: 6,
  },
  policyBox: {
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 4,
    padding: 10,
    marginTop: 4,
    marginBottom: 8,
  },
  policyText: { fontSize: 8, color: C.text, lineHeight: 1.45 },

  footer: {
    position: "absolute",
    bottom: 22,
    left: 36,
    right: 36,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: C.border,
    fontSize: 7,
    color: C.muted,
    textAlign: "center",
  },
});

function HotelBuildingIcon() {
  return (
    <Svg viewBox="0 0 24 24" width={18} height={18}>
      <Rect x="4" y="3" width="16" height="18" rx="1.5" fill={ACCENT} />
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

export function HotelVoucherPDF({ agency, booking, hotel, guests, logoSrc }: Props) {
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
  const inclusions = hotel.inclusions?.trim();
  const showCancellation = hotel.includeCancellationPolicy && Boolean(hotel.cancellationPolicy?.trim());
  const amenities = hotel.roomAmenities || [];

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.headerBand}>
          <View style={styles.headerRow}>
            {logoSrc ? (
              <PdfLogo src={logoSrc} square={brandUsesSquareLogo(agency.companyName)} />
            ) : (
              <Text style={styles.agencyName}>{agency.companyName}</Text>
            )}
            <View style={styles.agencyBlock}>
              <Text style={styles.agencyName}>{agency.companyName}</Text>
              {agency.address ? <Text style={styles.agencyLine}>{agency.address}</Text> : null}
              {(agency.city || agency.state || agency.pincode) && (
                <Text style={styles.agencyLine}>
                  {[agency.city, agency.state].filter(Boolean).join(", ")}
                  {agency.pincode ? ` - ${agency.pincode}` : ""}
                </Text>
              )}
              {agency.phone ? <Text style={styles.agencyLine}>Contact: {agency.phone}</Text> : null}
              {agency.email ? <Text style={styles.agencyLine}>Email: {agency.email}</Text> : null}
            </View>
          </View>
        </View>

        <View style={styles.metaRow}>
          <View style={styles.metaCol}>
            <Text style={styles.metaLabel}>Booking ID</Text>
            <Text style={styles.metaValue}>{booking.publicRef}</Text>
          </View>
          <View style={styles.metaCol}>
            <Text style={styles.metaLabel}>Booking Date</Text>
            <Text style={styles.metaValue}>{format(booking.createdAt, "dd MMM yyyy")}</Text>
          </View>
          <View style={styles.badgeWrap}>
            <View style={isConfirmed ? styles.badge : [styles.badge, styles.badgePending]}>
              <Text style={isConfirmed ? styles.badgeText : [styles.badgeText, styles.badgeTextPending]}>
                {isConfirmed ? "BOOKING CONFIRMED" : "BOOKING PENDING"}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.confirmBox}>
          <View>
            <Text style={styles.confirmLabel}>Hotel Confirmation Number</Text>
            <Text style={styles.confirmValue}>{supplierConfirmation || "—"}</Text>
          </View>
          {hotel.city ? (
            <Text style={styles.cityLine}>
              {hotel.city} · {hotel.nights} Night{hotel.nights !== 1 ? "s" : ""}
            </Text>
          ) : null}
        </View>

        <View style={styles.hotelCard}>
          <View style={styles.hotelTitleRow}>
            <View style={styles.hotelIconWrap}>
              <HotelBuildingIcon />
            </View>
            <Text style={styles.hotelName}>{hotel.propertyName}</Text>
          </View>
          <Text style={styles.hotelAddress}>{hotel.propertyAddress}</Text>
          {hotel.propertyPhone ? (
            <Text style={styles.hotelContact}>Hotel contact: {hotel.propertyPhone}</Text>
          ) : null}
          {hotel.propertyEmail ? (
            <Text style={styles.hotelContact}>Email: {hotel.propertyEmail}</Text>
          ) : null}
        </View>

        <View style={styles.stayRow}>
          <View style={styles.stayCard}>
            <Text style={styles.stayLabel}>Check In</Text>
            <Text style={styles.stayTime}>{hotel.checkInTime}</Text>
            <Text style={styles.stayDate}>{format(hotel.checkIn, "EEE, dd MMM yyyy")}</Text>
          </View>
          <View style={styles.stayCard}>
            <Text style={styles.stayLabel}>Check Out</Text>
            <Text style={styles.stayTime}>{hotel.checkOutTime}</Text>
            <Text style={styles.stayDate}>{format(hotel.checkOut, "EEE, dd MMM yyyy")}</Text>
          </View>
        </View>

        <View style={styles.summaryBar}>
          <View style={styles.summaryChip}>
            <Text style={styles.summaryChipText}>
              {hotel.nights} Night{hotel.nights !== 1 ? "s" : ""}
            </Text>
          </View>
          <View style={styles.summaryChip}>
            <Text style={styles.summaryChipText}>
              {adults} Adult{adults !== 1 ? "s" : ""}
              {children > 0 ? `, ${children} Child${children !== 1 ? "ren" : ""}` : ""}
            </Text>
          </View>
          <View style={styles.summaryChip}>
            <Text style={styles.summaryChipText}>
              {rooms.length} Room{rooms.length !== 1 ? "s" : ""}
            </Text>
          </View>
          <View style={styles.summaryChip}>
            <Text style={styles.summaryChipText}>{mealPlanLabel}</Text>
          </View>
        </View>

        {rooms.map((room) => {
          const guestNames = formatRoomGuestNames(room);
          return (
            <View key={room.roomNumber} style={styles.roomBox} wrap={false}>
              <View style={styles.roomHeader}>
                <Text style={styles.roomTitle}>
                  Room {room.roomNumber} · {hotel.roomType}
                </Text>
                <Text style={styles.roomOccupancy}>
                  {room.adultsCount} Adult{room.adultsCount !== 1 ? "s" : ""}
                  {room.childrenCount > 0
                    ? `, ${room.childrenCount} Child${room.childrenCount !== 1 ? "ren" : ""}`
                    : ""}
                </Text>
              </View>
              {guestNames ? <Text style={styles.roomGuests}>Guests: {guestNames}</Text> : null}
              <View style={styles.roomDivider} />
              <View style={styles.roomMetaRow}>
                <Text style={styles.roomMetaLabel}>Meal plan</Text>
                <Text style={styles.roomMetaValue}>{mealPlanLabel}</Text>
              </View>
              {inclusions ? (
                <View style={styles.roomMetaRow}>
                  <Text style={styles.roomMetaLabel}>Inclusions</Text>
                  <Text style={styles.roomMetaValue}>{inclusions}</Text>
                </View>
              ) : null}
            </View>
          );
        })}

        {amenities.length > 0 && (
          <View>
            <Text style={styles.sectionTitle}>Room Amenities</Text>
            <View style={styles.amenitiesGrid}>
              {amenities.map((amenity) => (
                <Text key={amenity} style={styles.amenityItem}>
                  • {amenity}
                </Text>
              ))}
            </View>
          </View>
        )}

        {showCancellation && (
          <View>
            <Text style={styles.sectionTitle}>Cancellation Policy</Text>
            <View style={styles.policyBox}>
              <Text style={styles.policyText}>{hotel.cancellationPolicy}</Text>
            </View>
          </View>
        )}

        {hotel.agentRemarks?.trim() ? (
          <View>
            <Text style={styles.sectionTitle}>Remarks</Text>
            <View style={styles.policyBox}>
              <Text style={styles.policyText}>{hotel.agentRemarks}</Text>
            </View>
          </View>
        ) : null}

        <Text style={styles.footer}>
          Present a valid photo ID at check-in. Early check-in / late check-out subject to availability.
          {"  ·  "}
          {agency.companyName}
          {agency.phone ? `  ·  ${agency.phone}` : ""}
        </Text>
      </Page>
    </Document>
  );
}
