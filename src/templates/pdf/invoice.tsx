import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import type { AgencySettings, Booking, Customer, FlightBooking, Payment } from "@prisma/client";
import type { FlightPassenger, FlightSegment } from "@/types/booking";
import { format } from "date-fns";
import { extractPanFromGstin } from "@/lib/gstin-lookup";
import { getStateCodeFromGstin } from "@/lib/gst-calculator";

const styles = StyleSheet.create({
  page: { padding: 32, fontSize: 8, fontFamily: "Helvetica", color: "#111" },
  header: { flexDirection: "row", justifyContent: "space-between", marginBottom: 12 },
  title: { fontSize: 14, fontWeight: "bold" },
  invoiceTitle: { fontSize: 12, fontWeight: "bold", textAlign: "right" },
  box: { border: "1px solid #ccc", marginBottom: 10 },
  boxRow: { flexDirection: "row" },
  boxCol: { flex: 1, padding: 8, borderRight: "1px solid #ccc" },
  boxColLast: { flex: 1, padding: 8 },
  label: { fontSize: 7, color: "#555", marginBottom: 2 },
  bold: { fontWeight: "bold" },
  table: { border: "1px solid #ccc", marginTop: 8 },
  tableHeader: { flexDirection: "row", backgroundColor: "#f3f4f6", borderBottom: "1px solid #ccc" },
  tableRow: { flexDirection: "row", borderBottom: "1px solid #eee" },
  th: { padding: 5, fontWeight: "bold", fontSize: 7 },
  td: { padding: 5, fontSize: 7 },
  c1: { width: "5%" },
  c2: { width: "38%" },
  c3: { width: "10%" },
  c4: { width: "8%" },
  c5: { width: "12%" },
  c6: { width: "9%" },
  c7: { width: "9%" },
  c8: { width: "9%" },
  right: { textAlign: "right" },
  totals: { marginTop: 8, alignItems: "flex-end" },
  totalRow: { flexDirection: "row", width: 220, justifyContent: "space-between", marginBottom: 3 },
  taxTable: { marginTop: 10, border: "1px solid #ccc" },
  footer: { position: "absolute", bottom: 24, left: 32, right: 32, fontSize: 7, color: "#666", textAlign: "center" },
});

function inr(n: number) {
  return `₹${n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

interface Props {
  agency: AgencySettings;
  booking: Booking;
  customer: Customer;
  payments: Payment[];
  flight?: FlightBooking | null;
  segments?: FlightSegment[];
  passengers?: FlightPassenger[];
}

export function InvoicePDF({ agency, booking, customer, payments, flight, segments = [], passengers = [] }: Props) {
  const invoiceNo = `${agency.invoicePrefix}-${booking.publicRef}`;
  const payment = payments[0];
  const agencyStateCode = getStateCodeFromGstin(agency.gstin);
  const agencyPan = agency.gstin ? extractPanFromGstin(agency.gstin) : null;

  const isFlightInvoice =
    booking.productType === "FLIGHT" &&
    flight &&
    flight.baseFare != null &&
    flight.serviceCharge != null;

  const baseFare = isFlightInvoice ? Number(flight.baseFare) : Number(booking.totalAmount);
  const serviceCharge = isFlightInvoice ? Number(flight.serviceCharge) : 0;
  const cgst = isFlightInvoice ? Number(flight.cgstAmount || 0) : 0;
  const sgst = isFlightInvoice ? Number(flight.sgstAmount || 0) : 0;
  const igst = isFlightInvoice ? Number(flight.igstAmount || 0) : 0;
  const totalTax = cgst + sgst + igst;
  const serviceLineTotal = serviceCharge + totalTax;
  const grandTotal = isFlightInvoice ? baseFare + serviceLineTotal : Number(booking.totalAmount);

  const segment = segments[0];
  const passenger = passengers[0];
  const sector = segment ? `${segment.fromAirport}-${segment.toAirport}` : "";
  const travelDate = segment?.departureAt
    ? format(new Date(segment.departureAt), "dd/MM/yyyy")
    : format(booking.createdAt, "dd/MM/yyyy");
  const passengerName = passenger
    ? `${passenger.title} ${passenger.firstName} ${passenger.lastName}`.trim()
    : customer.name;

  const buyerGstin = flight?.buyerGstin || customer.gstin;
  const buyerState = flight?.buyerState || customer.state;
  const buyerStateCode = flight?.buyerStateCode || getStateCodeFromGstin(buyerGstin);
  const placeOfSupply = flight?.placeOfSupply || buyerState || agency.state;

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>{agency.companyName}</Text>
            <Text>{agency.address}</Text>
            <Text>{[agency.city, agency.state, agency.pincode].filter(Boolean).join(", ")}</Text>
            {agency.gstin && <Text>GSTIN: {agency.gstin}</Text>}
            {agencyPan && <Text>PAN: {agencyPan}</Text>}
            {agencyStateCode && <Text>State Code: {agencyStateCode}</Text>}
            {agency.msmeRegistered && agency.msmeNumber && (
              <Text>MSME/Udyam: {agency.msmeNumber}</Text>
            )}
            <Text>Phone: {agency.phone} | {agency.email}</Text>
          </View>
          <View>
            <Text style={styles.invoiceTitle}>TAX INVOICE</Text>
            <Text style={styles.right}>Invoice No: {invoiceNo}</Text>
            <Text style={styles.right}>Date: {format(booking.createdAt, "dd MMM yyyy")}</Text>
            <Text style={styles.right}>Booking ID: {booking.publicRef}</Text>
            {booking.pnr && <Text style={styles.right}>PNR: {booking.pnr}</Text>}
            {isFlightInvoice && (
              <Text style={styles.right}>
                Type: {flight.invoiceTaxType === "ITC" ? "ITC (B2B)" : "Non-ITC (B2C)"}
              </Text>
            )}
          </View>
        </View>

        <View style={styles.box}>
          <View style={styles.boxRow}>
            <View style={styles.boxCol}>
              <Text style={styles.label}>Bill To</Text>
              <Text style={styles.bold}>{customer.name}</Text>
              {buyerGstin && <Text>GSTIN/UIN: {buyerGstin}</Text>}
              {(customer.address || customer.city) && (
                <Text>
                  {[customer.address, customer.city, customer.state, customer.pincode].filter(Boolean).join(", ")}
                </Text>
              )}
              {buyerStateCode && <Text>State Code: {buyerStateCode}</Text>}
              {placeOfSupply && <Text>Place of Supply: {placeOfSupply}</Text>}
            </View>
            <View style={styles.boxColLast}>
              <Text style={styles.label}>Booking Details</Text>
              <Text>Product: {booking.productType}</Text>
              <Text>Channel: {booking.channel}</Text>
              {payment && <Text>Payment: {payment.method}</Text>}
              <Text>Status: {booking.paymentStatus}</Text>
            </View>
          </View>
        </View>

        {isFlightInvoice ? (
          <>
            <View style={styles.table}>
              <View style={styles.tableHeader}>
                <Text style={[styles.th, styles.c1]}>#</Text>
                <Text style={[styles.th, styles.c2]}>Description of Services</Text>
                <Text style={[styles.th, styles.c3]}>HSN/SAC</Text>
                <Text style={[styles.th, styles.c4, styles.right]}>Qty</Text>
                <Text style={[styles.th, styles.c5, styles.right]}>Rate</Text>
                <Text style={[styles.th, styles.c6, styles.right]}>Taxable</Text>
                <Text style={[styles.th, styles.c7, styles.right]}>Tax</Text>
                <Text style={[styles.th, styles.c8, styles.right]}>Amount</Text>
              </View>

              <View style={styles.tableRow}>
                <Text style={[styles.td, styles.c1]}>1</Text>
                <Text style={[styles.td, styles.c2]}>
                  {flight.airline} Airlines (Fare Reimbursement) Domestic{"\n"}
                  PNR: {booking.pnr || "—"} | {passengerName} | {sector} | {travelDate}
                </Text>
                <Text style={[styles.td, styles.c3]}>—</Text>
                <Text style={[styles.td, styles.c4, styles.right]}>1</Text>
                <Text style={[styles.td, styles.c5, styles.right]}>{inr(baseFare)}</Text>
                <Text style={[styles.td, styles.c6, styles.right]}>—</Text>
                <Text style={[styles.td, styles.c7, styles.right]}>—</Text>
                <Text style={[styles.td, styles.c8, styles.right]}>{inr(baseFare)}</Text>
              </View>

              <View style={styles.tableRow}>
                <Text style={[styles.td, styles.c1]}>2</Text>
                <Text style={[styles.td, styles.c2]}>
                  Service Charges on Air Tickets (Domestic) @ {flight.igstRate ? "18% IGST" : "18% CGST+SGST"}
                </Text>
                <Text style={[styles.td, styles.c3]}>{flight.hsnSac || "998551"}</Text>
                <Text style={[styles.td, styles.c4, styles.right]}>1</Text>
                <Text style={[styles.td, styles.c5, styles.right]}>{inr(serviceCharge)}</Text>
                <Text style={[styles.td, styles.c6, styles.right]}>{inr(serviceCharge)}</Text>
                <Text style={[styles.td, styles.c7, styles.right]}>{inr(totalTax)}</Text>
                <Text style={[styles.td, styles.c8, styles.right]}>{inr(serviceLineTotal)}</Text>
              </View>
            </View>

            <View style={styles.taxTable}>
              <View style={styles.tableHeader}>
                <Text style={[styles.th, { width: "20%" }]}>HSN/SAC</Text>
                <Text style={[styles.th, { width: "20%" }, styles.right]}>Taxable Value</Text>
                <Text style={[styles.th, { width: "15%" }, styles.right]}>CGST</Text>
                <Text style={[styles.th, { width: "15%" }, styles.right]}>SGST/UTGST</Text>
                <Text style={[styles.th, { width: "15%" }, styles.right]}>IGST</Text>
                <Text style={[styles.th, { width: "15%" }, styles.right]}>Total Tax</Text>
              </View>
              <View style={styles.tableRow}>
                <Text style={[styles.td, { width: "20%" }]}>{flight.hsnSac || "998551"}</Text>
                <Text style={[styles.td, { width: "20%" }, styles.right]}>{inr(serviceCharge)}</Text>
                <Text style={[styles.td, { width: "15%" }, styles.right]}>
                  {cgst > 0 ? `${flight.cgstRate}% ${inr(cgst)}` : "—"}
                </Text>
                <Text style={[styles.td, { width: "15%" }, styles.right]}>
                  {sgst > 0 ? `${flight.sgstRate}% ${inr(sgst)}` : "—"}
                </Text>
                <Text style={[styles.td, { width: "15%" }, styles.right]}>
                  {igst > 0 ? `${flight.igstRate}% ${inr(igst)}` : "—"}
                </Text>
                <Text style={[styles.td, { width: "15%" }, styles.right]}>{inr(totalTax)}</Text>
              </View>
            </View>
          </>
        ) : (
          <View style={styles.table}>
            <View style={styles.tableHeader}>
              <Text style={[styles.th, styles.c2]}>Description</Text>
              <Text style={[styles.th, styles.c8, styles.right]}>Amount</Text>
            </View>
            <View style={styles.tableRow}>
              <Text style={[styles.td, styles.c2]}>
                {booking.productType} Booking - {booking.publicRef}
                {booking.pnr ? ` (PNR: ${booking.pnr})` : ""}
              </Text>
              <Text style={[styles.td, styles.c8, styles.right]}>{inr(grandTotal)}</Text>
            </View>
          </View>
        )}

        <View style={styles.totals}>
          {isFlightInvoice && (
            <>
              <View style={styles.totalRow}>
                <Text>Base Fare (Reimbursement):</Text>
                <Text>{inr(baseFare)}</Text>
              </View>
              <View style={styles.totalRow}>
                <Text>Service Charge + Tax:</Text>
                <Text>{inr(serviceLineTotal)}</Text>
              </View>
            </>
          )}
          <View style={styles.totalRow}>
            <Text style={styles.bold}>Invoice Total:</Text>
            <Text style={styles.bold}>{inr(grandTotal)}</Text>
          </View>
        </View>

        <Text style={styles.footer}>
          This is a computer-generated tax invoice. Thank you for choosing {agency.companyName}.
        </Text>
      </Page>
    </Document>
  );
}
