import React from "react";
import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import type { AgencySettings, Booking, Customer, FlightBooking, Payment } from "@prisma/client";
import type { FlightPassenger, FlightSegment } from "@/types/booking";
import { format } from "date-fns";
import { extractPanFromGstin } from "@/lib/gstin-lookup";
import { getStateCodeFromGstin } from "@/lib/gst-calculator";
import { amountInWordsInr } from "@/lib/number-to-words";
import { CABIN_CLASS_OPTIONS, fareTypeLabel } from "@/lib/constants/flight";
import { PdfLogo } from "@/templates/pdf/pdf-logo";
import { buildFullRoute, buildSectorLegs, buildSectorSummary } from "@/lib/flight-layover";
import { buildBaseFareLines, farePassengerQtyLabel, passengerDisplayName, paxTypeUnitLabel } from "@/lib/flight-fare-breakup";
import { addonDetailLines, addonTypeLabel } from "@/lib/flight-addon";

const styles = StyleSheet.create({
  page: { padding: 28, fontSize: 8, fontFamily: "Helvetica", color: "#000" },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 },
  companyBlock: { maxWidth: "58%", alignItems: "flex-start" },
  companyName: { fontSize: 11, fontWeight: "bold", marginBottom: 3, color: "#000" },
  companyLine: { fontSize: 7.5, marginBottom: 2, color: "#000", lineHeight: 1.35 },
  invoiceMeta: { textAlign: "right", maxWidth: "34%" },
  taxInvoiceTitle: { fontSize: 12, fontWeight: "bold", marginBottom: 4, color: "#000" },
  metaLine: { fontSize: 7.5, marginBottom: 2, color: "#000" },
  box: { border: "1px solid #999", marginBottom: 8 },
  boxHeader: { backgroundColor: "#f3f4f6", padding: 5, borderBottom: "1px solid #999", fontWeight: "bold", fontSize: 7.5, color: "#000" },
  boxBody: { padding: 6 },
  boxLine: { fontSize: 7.5, marginBottom: 2, color: "#000", lineHeight: 1.35 },
  table: { border: "1px solid #999", marginTop: 4 },
  tableHeader: { flexDirection: "row", backgroundColor: "#e5e7eb", borderBottom: "1px solid #999" },
  tableRow: { flexDirection: "row", borderBottom: "1px solid #ddd", alignItems: "flex-start" },
  th: { padding: 5, fontWeight: "bold", fontSize: 7, color: "#000", borderRight: "1px solid #ccc" },
  td: { padding: 5, fontSize: 7, color: "#000", borderRight: "1px solid #eee", lineHeight: 1.35 },
  // B2C: 9 columns
  b2cSl: { width: "4%" },
  b2cDesc: { width: "31%" },
  b2cHsn: { width: "8%" },
  b2cGst: { width: "7%" },
  b2cQty: { width: "8%" },
  b2cRate: { width: "12%" },
  b2cPer: { width: "5%" },
  b2cOther: { width: "12%" },
  b2cAmt: { width: "13%" },
  // B2B: 8 columns (no Other Charges column)
  b2bSl: { width: "4%" },
  b2bDesc: { width: "36%" },
  b2bHsn: { width: "9%" },
  b2bGst: { width: "8%" },
  b2bQty: { width: "8%" },
  b2bRate: { width: "13%" },
  b2bPer: { width: "5%" },
  b2bAmt: { width: "17%" },
  right: { textAlign: "right" },
  totalRow: { flexDirection: "row", backgroundColor: "#f9fafb", borderTop: "1px solid #999" },
  amountWords: { marginTop: 8, marginBottom: 6, fontSize: 7.5, color: "#000", lineHeight: 1.4 },
  remarksBox: {
    marginTop: 8,
    marginBottom: 8,
    padding: 8,
    border: "2px solid #f59e0b",
    backgroundColor: "#fffbeb",
  },
  remarksLabel: { fontSize: 7.5, fontWeight: "bold", color: "#92400e", marginBottom: 3 },
  remarksText: { fontSize: 8, color: "#78350f", lineHeight: 1.4 },
  taxBreakupTitle: { fontSize: 8, fontWeight: "bold", marginTop: 10, marginBottom: 4, color: "#000" },
  taxTable: { border: "1px solid #999" },
  taxThSub: { fontSize: 6.5, textAlign: "center", color: "#000" },
  footerGrid: { flexDirection: "row", marginTop: 12, gap: 8 },
  footerCol: { flex: 1, fontSize: 7.5, color: "#000", lineHeight: 1.35 },
  footerLabel: { fontWeight: "bold", marginBottom: 2 },
  signBlock: { marginTop: 20, alignItems: "flex-end" },
  signLine: { borderTop: "1px solid #333", width: 140, marginTop: 24, paddingTop: 4, fontSize: 7.5, textAlign: "center" },
  pageFooter: { position: "absolute", bottom: 20, left: 28, right: 28, fontSize: 7, color: "#444", textAlign: "center" },
  descBullet: { fontSize: 7, marginTop: 2, color: "#000", lineHeight: 1.35 },
  descTitle: { fontSize: 7, color: "#000", lineHeight: 1.35 },
});

function inr(n: number) {
  // Helvetica in react-pdf often renders ₹ poorly - use Rs.
  return `Rs. ${n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function cabinLabel(value?: string | null) {
  return CABIN_CLASS_OPTIONS.find((c) => c.value === value)?.label || value || "Economy";
}

function buildTravelDates(segments: FlightSegment[]) {
  return segments
    .map((s) => (s.departureAt ? format(new Date(s.departureAt), "dd/MM/yyyy") : ""))
    .filter(Boolean)
    .join(" / ");
}

interface Props {
  agency: AgencySettings;
  booking: Booking;
  customer: Customer;
  payments: Payment[];
  flight?: FlightBooking | null;
  segments?: FlightSegment[];
  passengers?: FlightPassenger[];
  logoSrc?: string | null;
}

export function InvoicePDF({
  agency,
  booking,
  customer,
  payments,
  flight,
  segments = [],
  passengers = [],
  logoSrc,
}: Props) {
  const invoiceNo = `${agency.invoicePrefix}-${booking.publicRef.replace(/^FB-/, "TRVL")}`;
  const payment = payments[0];
  const agencyStateCode = getStateCodeFromGstin(agency.gstin);
  const agencyPan = agency.pan || (agency.gstin ? extractPanFromGstin(agency.gstin) : null);
  const isB2B = flight?.invoiceTaxType === "ITC";
  const hasGstInvoice = Boolean(agency.gstin?.trim() && flight?.baseFare != null && flight?.serviceCharge != null);

  const baseFare = hasGstInvoice ? Number(flight!.baseFare) : Number(booking.totalAmount);
  const serviceCharge = hasGstInvoice ? Number(flight!.serviceCharge) : 0;
  const discount = hasGstInvoice ? Number(flight!.discountAmount || 0) : 0;
  const cgst = hasGstInvoice ? Number(flight!.cgstAmount || 0) : 0;
  const sgst = hasGstInvoice ? Number(flight!.sgstAmount || 0) : 0;
  const igst = hasGstInvoice ? Number(flight!.igstAmount || 0) : 0;
  const totalTax = cgst + sgst + igst;
  const gatewayCharge = hasGstInvoice ? Number(flight!.paymentGatewayCharge || 0) : 0;
  const grandTotal = hasGstInvoice
    ? baseFare + serviceCharge + totalTax - discount + gatewayCharge
    : Number(booking.totalAmount);

  const sector = buildSectorSummary(segments, flight?.tripType);
  const sectorLegs = buildSectorLegs(segments, flight?.tripType);
  const travelDate = buildTravelDates(segments) || format(booking.createdAt, "dd/MM/yyyy");
  const pnrLine = [
    booking.pnr ? `PNR: ${booking.pnr}` : null,
    flight?.secondaryPnr ? `Return PNR: ${flight.secondaryPnr}` : null,
  ]
    .filter(Boolean)
    .join(" | ");

  const buyerGstin = flight?.buyerGstin || customer.gstin;
  const buyerState = flight?.buyerState || customer.state;
  const placeOfSupply = flight?.placeOfSupply || buyerState || agency.state;
  const msmeNumber = flight?.msmeNumber || (agency.msmeRegistered ? agency.msmeNumber : null);
  const fareLines = buildBaseFareLines(passengers, baseFare);
  const qtyLabel = farePassengerQtyLabel(fareLines);

  const fareDescription = flight
    ? flight.tripType === "ADDON_SERVICES"
      ? `${flight.airline} - ${addonTypeLabel(flight.addonType, flight.addonCustomLabel)}`
      : `${flight.airline} Airlines (Fare Reimbursement) Domestic`
    : `${booking.productType} Booking`;

  const showPassengerName = flight?.showPassengerName !== false;

  const itineraryDetailLines = [
    pnrLine,
    ...(flight?.tripType === "ADDON_SERVICES"
      ? addonDetailLines(flight.addonType, flight.addonCustomLabel, flight.addonCustomValue, passengers)
      : []),
    sector && flight?.tripType !== "ADDON_SERVICES" ? `Sector: ${sector}` : null,
    ...sectorLegs.map((leg) => `${leg.label}: ${leg.sector} (${leg.date || "-"})`),
    segments.length > 1 && flight?.tripType !== "ROUND_TRIP"
      ? `Route: ${buildFullRoute(segments)}`
      : null,
    travelDate ? `Travel Date: ${travelDate}` : null,
    flight?.cabinClass ? `Class: ${cabinLabel(flight.cabinClass)}` : null,
    flight?.fareType ? `Fare Type: ${fareTypeLabel(flight.fareType)}` : null,
  ].filter(Boolean) as string[];

  const gstRateLabel =
    igst > 0
      ? `${Number(flight?.igstRate || 0)}%`
      : cgst > 0
        ? `${Number(flight?.cgstRate || 0)}% + ${Number(flight?.sgstRate || 0)}%`
        : "18%";

  // Same main-table layout for B2B and B2C: fare row + Other Charges column; B2B tax detail only in breakup section below.
  const col = {
    sl: styles.b2cSl,
    desc: styles.b2cDesc,
    hsn: styles.b2cHsn,
    gst: styles.b2cGst,
    qty: styles.b2cQty,
    rate: styles.b2cRate,
    per: styles.b2cPer,
    other: styles.b2cOther,
    amt: styles.b2cAmt,
    totalLabel: { width: "75%" as const },
  };

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.headerRow}>
          <View style={styles.companyBlock}>
            {logoSrc ? (
              <PdfLogo src={logoSrc} variant="invoice" />
            ) : (
              <Text style={styles.companyName}>{agency.companyName}</Text>
            )}
            {agency.address && <Text style={styles.companyLine}>{agency.address}</Text>}
            <Text style={styles.companyLine}>
              {[agency.city, agency.state, agency.pincode].filter(Boolean).join(", ")}
            </Text>
            {agency.tan && <Text style={styles.companyLine}>Company&apos;s TAN: {agency.tan}</Text>}
            {agency.gstin && <Text style={styles.companyLine}>GSTIN/UIN: {agency.gstin}</Text>}
            {agencyPan && <Text style={styles.companyLine}>PAN/IT No: {agencyPan}</Text>}
            {agency.state && (
              <Text style={styles.companyLine}>
                State Name: {agency.state}
                {agencyStateCode ? `, Code: ${agencyStateCode}` : ""}
              </Text>
            )}
            {(agency.phone || agency.email) && (
              <Text style={styles.companyLine}>
                Contact: {agency.phone || "-"} | {agency.email || "-"}
              </Text>
            )}
            {msmeNumber && <Text style={styles.companyLine}>MSME/Udyam: {msmeNumber}</Text>}
          </View>
          <View style={styles.invoiceMeta}>
            <Text style={styles.taxInvoiceTitle}>TAX INVOICE</Text>
            <Text style={styles.metaLine}>Invoice No.: {invoiceNo}</Text>
            <Text style={styles.metaLine}>Dated: {format(booking.createdAt, "dd-MMM-yy")}</Text>
            <Text style={styles.metaLine}>Booking ID: {booking.publicRef}</Text>
            {booking.pnr && <Text style={styles.metaLine}>PNR: {booking.pnr}</Text>}
          </View>
        </View>

        <View style={styles.box}>
          <Text style={styles.boxHeader}>Buyer (Bill to)</Text>
          <View style={styles.boxBody}>
            <Text style={[styles.boxLine, { fontWeight: "bold" }]}>{customer.name}</Text>
            {(customer.address || customer.city) && (
              <Text style={styles.boxLine}>
                {[customer.address, customer.city, customer.state, customer.pincode].filter(Boolean).join(", ")}
              </Text>
            )}
            {buyerGstin && <Text style={styles.boxLine}>GSTIN/UIN: {buyerGstin}</Text>}
            {customer.pan && <Text style={styles.boxLine}>PAN/IT No: {customer.pan}</Text>}
            {buyerState && <Text style={styles.boxLine}>State Name: {buyerState}</Text>}
            {placeOfSupply && <Text style={styles.boxLine}>Place of Supply: {placeOfSupply}</Text>}
            {customer.phone && <Text style={styles.boxLine}>Contact: {customer.phone}</Text>}
            {payment && <Text style={styles.boxLine}>Payment: {payment.method}</Text>}
          </View>
        </View>

        {hasGstInvoice && booking.productType === "FLIGHT" && flight ? (
          <>
            <View style={styles.table}>
              <View style={styles.tableHeader}>
                <Text style={[styles.th, col.sl]}>Sl</Text>
                <Text style={[styles.th, col.desc]}>Description of Services</Text>
                <Text style={[styles.th, col.hsn]}>HSN/SAC</Text>
                <Text style={[styles.th, col.gst, styles.right]}>GST Rate</Text>
                <Text style={[styles.th, col.qty, styles.right]}>Qty</Text>
                <Text style={[styles.th, col.rate, styles.right]}>Rate</Text>
                <Text style={[styles.th, col.per]}>per</Text>
                <Text style={[styles.th, col.other, styles.right]}>Other Charges</Text>
                <Text style={[styles.th, col.amt, styles.right]}>Amount</Text>
              </View>

              {fareLines.map((line, idx) => {
                const typeLabel = paxTypeUnitLabel(line.passenger);
                const typeCounters = fareLines
                  .slice(0, idx + 1)
                  .filter((l) => (l.passenger.paxType || "adult") === (line.passenger.paxType || "adult"))
                  .length;
                const paxName = showPassengerName
                  ? passengerDisplayName(line.passenger)
                  : `${typeLabel} ${typeCounters}`;
                return (
                  <View style={styles.tableRow} key={`fare-row-${idx}`}>
                    <Text style={[styles.td, col.sl]}>{idx + 1}</Text>
                    <View style={[styles.td, col.desc]}>
                      <Text style={styles.descTitle}>
                        {fareDescription} - {paxName}
                      </Text>
                      {idx === 0 &&
                        itineraryDetailLines.map((detail) => (
                          <Text key={detail} style={styles.descBullet}>
                            • {detail}
                          </Text>
                        ))}
                    </View>
                    <Text style={[styles.td, col.hsn]}>-</Text>
                    <Text style={[styles.td, col.gst, styles.right]}>-</Text>
                    <Text style={[styles.td, col.qty, styles.right]}>1</Text>
                    <Text style={[styles.td, col.rate, styles.right]}>{inr(line.amount)}</Text>
                    <Text style={[styles.td, col.per]}>{typeLabel}</Text>
                    <Text style={[styles.td, col.other, styles.right]}>{inr(0)}</Text>
                    <Text style={[styles.td, col.amt, styles.right]}>{inr(line.amount)}</Text>
                  </View>
                );
              })}

              <View style={styles.tableRow}>
                <Text style={[styles.td, col.sl]}>{fareLines.length + 1}</Text>
                <View style={[styles.td, col.desc]}>
                  <Text style={styles.descTitle}>Booking / Service Fee (Domestic)</Text>
                </View>
                <Text style={[styles.td, col.hsn]}>{flight.hsnSac || "998551"}</Text>
                <Text style={[styles.td, col.gst, styles.right]}>{gstRateLabel}</Text>
                <Text style={[styles.td, col.qty, styles.right]}>1</Text>
                <Text style={[styles.td, col.rate, styles.right]}>{inr(serviceCharge)}</Text>
                <Text style={[styles.td, col.per]}>Job</Text>
                <Text style={[styles.td, col.other, styles.right]}>{inr(totalTax)}</Text>
                <Text style={[styles.td, col.amt, styles.right]}>{inr(serviceCharge + totalTax)}</Text>
              </View>

              <View style={styles.totalRow}>
                <Text style={[styles.td, col.sl]} />
                <Text style={[styles.td, col.totalLabel, { textAlign: "right", fontWeight: "bold", borderRight: "none" }]}>
                  Total
                </Text>
                <Text style={[styles.td, col.qty, styles.right, { fontWeight: "bold" }]}>{qtyLabel}</Text>
                <Text style={[styles.td, col.amt, styles.right, { fontWeight: "bold" }]}>
                  {inr(grandTotal)}
                </Text>
              </View>
            </View>

            <Text style={styles.amountWords}>
              Amount Chargeable (in words): {amountInWordsInr(grandTotal)}
            </Text>

            {isB2B && totalTax > 0 && (
              <>
                <Text style={styles.taxBreakupTitle}>Tax Breakup</Text>
                <View style={styles.taxTable}>
                  <View style={styles.tableHeader}>
                    <Text style={[styles.th, { width: "14%" }]}>HSN/SAC</Text>
                    <Text style={[styles.th, { width: "16%" }, styles.right]}>Taxable Value</Text>
                    <Text style={[styles.th, { width: "14%" }]}>CGST</Text>
                    <Text style={[styles.th, { width: "14%" }]}>SGST/UTGST</Text>
                    <Text style={[styles.th, { width: "14%" }]}>IGST</Text>
                    <Text style={[styles.th, { width: "14%" }, styles.right]}>Total Tax</Text>
                  </View>
                  <View style={styles.tableRow}>
                    <Text style={[styles.td, { width: "14%" }]}>{flight.hsnSac || "998551"}</Text>
                    <Text style={[styles.td, { width: "16%" }, styles.right]}>{inr(serviceCharge)}</Text>
                    <View style={[styles.td, { width: "14%" }]}>
                      {cgst > 0 ? (
                        <>
                          <Text style={styles.taxThSub}>Rate: {Number(flight.cgstRate)}%</Text>
                          <Text>Amt: {inr(cgst)}</Text>
                        </>
                      ) : (
                        <Text>-</Text>
                      )}
                    </View>
                    <View style={[styles.td, { width: "14%" }]}>
                      {sgst > 0 ? (
                        <>
                          <Text style={styles.taxThSub}>Rate: {Number(flight.sgstRate)}%</Text>
                          <Text>Amt: {inr(sgst)}</Text>
                        </>
                      ) : (
                        <Text>-</Text>
                      )}
                    </View>
                    <View style={[styles.td, { width: "14%" }]}>
                      {igst > 0 ? (
                        <>
                          <Text style={styles.taxThSub}>Rate: {Number(flight.igstRate)}%</Text>
                          <Text>Amt: {inr(igst)}</Text>
                        </>
                      ) : (
                        <Text>-</Text>
                      )}
                    </View>
                    <Text style={[styles.td, { width: "14%" }, styles.right]}>{inr(totalTax)}</Text>
                  </View>
                </View>
                <Text style={[styles.amountWords, { marginTop: 4 }]}>
                  Tax Amount (in words): {amountInWordsInr(totalTax)}
                </Text>
              </>
            )}

            {discount > 0 && (
              <Text style={[styles.amountWords, { color: "#b45309" }]}>
                Discount Applied: −{inr(discount)}
              </Text>
            )}
            {gatewayCharge > 0 && (
              <Text style={styles.amountWords}>
                Card Payment Gateway Charge (2.5%): {inr(gatewayCharge)}
              </Text>
            )}
          </>
        ) : (
          <View style={styles.table}>
            <View style={styles.tableHeader}>
              <Text style={[styles.th, { width: "80%" }]}>Description</Text>
              <Text style={[styles.th, { width: "20%" }, styles.right]}>Amount</Text>
            </View>
            <View style={styles.tableRow}>
              <Text style={[styles.td, { width: "80%" }]}>
                {booking.productType} Booking - {booking.publicRef}
                {booking.pnr ? ` (PNR: ${booking.pnr})` : ""}
              </Text>
              <Text style={[styles.td, { width: "20%" }, styles.right]}>{inr(grandTotal)}</Text>
            </View>
          </View>
        )}

        {flight?.invoiceNarration && (
          <View style={styles.remarksBox}>
            <Text style={styles.remarksLabel}>Remarks</Text>
            <Text style={styles.remarksText}>{flight.invoiceNarration}</Text>
          </View>
        )}

        <View style={styles.footerGrid}>
          <View style={styles.footerCol}>
            {agencyPan && (
              <>
                <Text style={styles.footerLabel}>Company&apos;s PAN</Text>
                <Text style={{ marginBottom: 6 }}>{agencyPan}</Text>
              </>
            )}
            <Text style={styles.footerLabel}>Declaration</Text>
            <Text>
              We declare that this invoice shows the actual price of the services described and that all particulars are true and correct.
            </Text>
          </View>
          {(agency.bankName || agency.bankAccount) && (
            <View style={styles.footerCol}>
              <Text style={styles.footerLabel}>Company&apos;s Bank Details</Text>
              <Text>A/c Holder: {agency.companyName}</Text>
              {agency.bankName && <Text>Bank: {agency.bankName}</Text>}
              {agency.bankAccount && <Text>A/c No.: {agency.bankAccount}</Text>}
              {agency.bankBranch && <Text>Branch: {agency.bankBranch}</Text>}
              {agency.bankIfsc && <Text>IFSC: {agency.bankIfsc}</Text>}
            </View>
          )}
          <View style={styles.footerCol}>
            <View style={styles.signBlock}>
              <Text style={{ fontSize: 7 }}>for {agency.companyName}</Text>
              <Text style={styles.signLine}>Authorised Signatory</Text>
            </View>
          </View>
        </View>

        <Text style={styles.pageFooter}>
          SUBJECT TO {agency.city?.toUpperCase() || "KOLKATA"} JURISDICTION - This is a Computer Generated Invoice
        </Text>
      </Page>
    </Document>
  );
}
