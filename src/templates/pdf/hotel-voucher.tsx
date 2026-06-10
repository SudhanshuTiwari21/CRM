import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import type { AgencySettings, Booking, HotelBooking } from "@prisma/client";
import type { HotelGuest } from "@/types/booking";
import { format } from "date-fns";

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 9, fontFamily: "Helvetica" },
  header: { marginBottom: 20, borderBottom: "1px solid #ccc", paddingBottom: 10 },
  title: { fontSize: 16, fontWeight: "bold", color: "#1e3a8a" },
  subtitle: { fontSize: 10, color: "#666", marginTop: 4 },
  section: { marginTop: 16, marginBottom: 8 },
  sectionTitle: { fontSize: 11, fontWeight: "bold", marginBottom: 8, color: "#1e3a8a" },
  box: { border: "1px solid #ddd", padding: 12, marginBottom: 10 },
  row: { flexDirection: "row", marginBottom: 4 },
  label: { width: 140, fontWeight: "bold" },
  value: { flex: 1 },
  footer: { position: "absolute", bottom: 30, left: 40, right: 40, fontSize: 7, color: "#888" },
});

interface Props {
  agency: AgencySettings;
  booking: Booking;
  hotel: HotelBooking;
  guests: HotelGuest[];
}

export function HotelVoucherPDF({ agency, booking, hotel, guests }: Props) {
  const leadGuest = guests[0];

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.title}>{agency.companyName}</Text>
          <Text style={styles.subtitle}>
            {[agency.address, agency.city].filter(Boolean).join(", ")} | Phone: {agency.phone} | {agency.email}
          </Text>
        </View>

        <Text style={{ fontSize: 14, fontWeight: "bold", marginBottom: 12 }}>HOTEL VOUCHER</Text>

        <View style={styles.box}>
          <View style={styles.row}>
            <Text style={styles.label}>Confirmation No:</Text>
            <Text style={styles.value}>{hotel.confirmationNo || booking.pnr || booking.publicRef}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Booking ID:</Text>
            <Text style={styles.value}>{booking.publicRef}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Hotel Details</Text>
          <View style={styles.box}>
            <Text style={{ fontWeight: "bold", marginBottom: 4 }}>{hotel.propertyName}</Text>
            <Text>{hotel.propertyAddress}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Stay Information</Text>
          <View style={styles.row}>
            <Text style={styles.label}>Lead Guest:</Text>
            <Text style={styles.value}>{leadGuest?.name || "N/A"}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Check In:</Text>
            <Text style={styles.value}>{format(hotel.checkIn, "dd MMM yyyy")}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Check Out:</Text>
            <Text style={styles.value}>{format(hotel.checkOut, "dd MMM yyyy")}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Nights:</Text>
            <Text style={styles.value}>{hotel.nights}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Room Type:</Text>
            <Text style={styles.value}>{hotel.roomType}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Guests:</Text>
            <Text style={styles.value}>{guests.map((g) => g.name).join(", ")}</Text>
          </View>
        </View>

        {hotel.policies && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Hotel Policies</Text>
            <Text>{hotel.policies}</Text>
          </View>
        )}

        {hotel.agentRemarks && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Remarks</Text>
            <Text>{hotel.agentRemarks}</Text>
          </View>
        )}

        <Text style={styles.footer}>
          Present photo ID at check-in. Early check-in/late check-out subject to availability. Contact: {agency.phone}
        </Text>
      </Page>
    </Document>
  );
}
