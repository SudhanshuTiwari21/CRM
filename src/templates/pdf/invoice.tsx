import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import type { AgencySettings, Booking, Payment } from "@prisma/client";
import { format } from "date-fns";

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 9, fontFamily: "Helvetica" },
  header: { flexDirection: "row", justifyContent: "space-between", marginBottom: 24 },
  title: { fontSize: 18, fontWeight: "bold", color: "#1e3a8a" },
  invoiceNo: { fontSize: 12, fontWeight: "bold", textAlign: "right" },
  section: { marginBottom: 16 },
  row: { flexDirection: "row", justifyContent: "space-between", marginBottom: 4 },
  table: { border: "1px solid #ddd", marginTop: 16 },
  tableHeader: { flexDirection: "row", backgroundColor: "#f1f5f9", borderBottom: "1px solid #ddd" },
  tableRow: { flexDirection: "row", borderBottom: "1px solid #eee" },
  cell: { flex: 2, padding: 8 },
  cellSm: { flex: 1, padding: 8, textAlign: "right" },
  cellBold: { flex: 2, padding: 8, fontWeight: "bold" },
  total: { marginTop: 16, alignItems: "flex-end" },
  totalRow: { flexDirection: "row", width: 200, justifyContent: "space-between", marginBottom: 4 },
  footer: { position: "absolute", bottom: 30, left: 40, right: 40, fontSize: 7, color: "#888", textAlign: "center" },
});

interface Props {
  agency: AgencySettings;
  booking: Booking;
  payments: Payment[];
}

export function InvoicePDF({ agency, booking, payments }: Props) {
  const invoiceNo = `${agency.invoicePrefix}-${booking.publicRef}`;
  const payment = payments[0];

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>{agency.companyName}</Text>
            <Text>{agency.address}</Text>
            <Text>
              {agency.city}, {agency.state} {agency.pincode}
            </Text>
            <Text>GSTIN: {agency.gstin}</Text>
            <Text>Phone: {agency.phone} | {agency.email}</Text>
          </View>
          <View>
            <Text style={styles.invoiceNo}>TAX INVOICE</Text>
            <Text style={{ textAlign: "right" }}>Invoice No: {invoiceNo}</Text>
            <Text style={{ textAlign: "right" }}>Date: {format(booking.createdAt, "dd MMM yyyy")}</Text>
            <Text style={{ textAlign: "right" }}>Booking ID: {booking.publicRef}</Text>
            {booking.pnr && <Text style={{ textAlign: "right" }}>PNR: {booking.pnr}</Text>}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={{ fontWeight: "bold", marginBottom: 4 }}>Bill To:</Text>
          <Text>Customer Booking Ref: {booking.publicRef}</Text>
          <Text>Product: {booking.productType}</Text>
          <Text>Channel: {booking.channel}</Text>
        </View>

        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={styles.cellBold}>Description</Text>
            <Text style={{ ...styles.cellBold, flex: 1, textAlign: "right" }}>Amount</Text>
          </View>
          <View style={styles.tableRow}>
            <Text style={styles.cell}>
              {booking.productType} Booking - {booking.publicRef}
              {booking.pnr ? ` (PNR: ${booking.pnr})` : ""}
            </Text>
            <Text style={styles.cellSm}>₹{Number(booking.totalAmount).toLocaleString("en-IN")}</Text>
          </View>
        </View>

        <View style={styles.total}>
          <View style={styles.totalRow}>
            <Text>Subtotal:</Text>
            <Text>₹{Number(booking.totalAmount).toLocaleString("en-IN")}</Text>
          </View>
          <View style={styles.totalRow}>
            <Text style={{ fontWeight: "bold" }}>Total:</Text>
            <Text style={{ fontWeight: "bold" }}>₹{Number(booking.totalAmount).toLocaleString("en-IN")}</Text>
          </View>
          <View style={styles.totalRow}>
            <Text>Payment Status:</Text>
            <Text>{booking.paymentStatus}</Text>
          </View>
          {payment && (
            <View style={styles.totalRow}>
              <Text>Payment Method:</Text>
              <Text>{payment.method}</Text>
            </View>
          )}
        </View>

        <Text style={styles.footer}>
          This is a computer-generated invoice. Thank you for choosing {agency.companyName}.
        </Text>
      </Page>
    </Document>
  );
}
