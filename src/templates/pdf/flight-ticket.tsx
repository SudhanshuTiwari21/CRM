import React from "react";
import { Document, Image, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import type { AgencySettings, Booking, FlightBooking } from "@prisma/client";
import type { CabinClass } from "@prisma/client";
import type { FlightPassenger, FlightSegment } from "@/types/booking";
import { getAirportDisplay } from "@/lib/airport-names";
import { resolveSegmentAirline } from "@/lib/airline-logo";
import { computeLayoverDuration } from "@/lib/flight-layover";
import { PdfLogo } from "@/templates/pdf/pdf-logo";
import { getVoucherTermsContent } from "@/templates/pdf/voucher-terms";
import { addonDetailLines, addonTypeLabel } from "@/lib/flight-addon";

const NAVY = "#1a2d3e";
const MUTED = "#5c6b7a";
const BORDER = "#d8dee6";
const FLIGHT_TZ = "Asia/Kolkata";

const styles = StyleSheet.create({
  page: {
    paddingTop: 36,
    paddingBottom: 40,
    paddingHorizontal: 42,
    fontSize: 9.5,
    fontFamily: "Helvetica",
    color: NAVY,
    backgroundColor: "#fff",
    lineHeight: 1.45,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 22,
  },
  agencyBlock: { alignItems: "flex-end", maxWidth: 240, flexShrink: 0 },
  agencyLine: { fontSize: 8.5, color: NAVY, lineHeight: 1.5, textAlign: "right" },
  agencyName: {
    fontFamily: "Helvetica-Bold",
    fontSize: 9.5,
    marginBottom: 2,
    textAlign: "right",
    color: NAVY,
  },
  sectionTitle: { fontSize: 13, fontFamily: "Helvetica-Bold", color: NAVY, marginBottom: 12, marginTop: 4 },
  detailGrid: { flexDirection: "row", flexWrap: "wrap", marginBottom: 18 },
  detailCell: { width: "25%", marginBottom: 10, paddingRight: 8 },
  detailLabel: { fontFamily: "Helvetica-Bold", fontSize: 9.5, marginBottom: 4 },
  detailValue: { fontSize: 9.5, color: "#2a3a4a" },
  departureHeading: { fontFamily: "Helvetica-Bold", fontSize: 10, marginBottom: 10 },
  flightRow: { flexDirection: "row", marginBottom: 8 },
  flightCol: { width: "33%" },
  flightColLabel: { fontFamily: "Helvetica-Bold", fontSize: 9.5, marginBottom: 3 },
  flightColValue: { fontSize: 9.5 },
  airlineRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  airlineLogo: { width: 14, height: 14, objectFit: "contain" as const },
  legBlock: { marginBottom: 14 },
  timeLine: { fontSize: 9.5, marginBottom: 4, color: "#2a3a4a" },
  layoverRow: { flexDirection: "row", alignItems: "center", marginVertical: 10, gap: 8 },
  layoverLine: { flex: 1, borderTopWidth: 1, borderTopColor: BORDER },
  layoverText: { fontSize: 8.5, color: MUTED, paddingHorizontal: 4 },
  baggageGrid: { flexDirection: "row", marginBottom: 16 },
  baggageCol: { width: "50%", paddingRight: 12 },
  paymentBox: { borderWidth: 1, borderColor: BORDER, borderRadius: 2, padding: 14, marginTop: 4, marginBottom: 20 },
  paymentRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 6, fontSize: 9.5 },
  paymentTotalRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: BORDER,
  },
  paymentTotal: { fontSize: 12, fontFamily: "Helvetica-Bold" },
  footerNote: { fontSize: 8, color: MUTED, marginTop: 8 },
  termsTitle: { fontSize: 16, fontFamily: "Helvetica-Bold", marginBottom: 10, color: NAVY },
  termsIntro: { fontSize: 9.5, marginBottom: 14, color: "#2a3a4a" },
  termsSectionHeading: { fontFamily: "Helvetica-Bold", fontSize: 9.5, marginTop: 12, marginBottom: 6, color: NAVY },
  termsParagraph: { fontSize: 9, marginBottom: 8, color: "#2a3a4a", lineHeight: 1.5 },
  termsItem: { fontSize: 9, marginBottom: 6, color: "#2a3a4a", lineHeight: 1.5 },
  termsItemLabel: { fontFamily: "Helvetica-Bold" },
  termsClosing: { fontFamily: "Helvetica-Bold", fontSize: 10, marginTop: 16, color: NAVY },
});

function formatVoucherDateTime(date: Date | string) {
  const d = new Date(date);
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: FLIGHT_TZ,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    day: "numeric",
    month: "long",
    year: "numeric",
    weekday: "long",
  }).formatToParts(d);
  const pick = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${pick("hour")}:${pick("minute")} ${pick("day")} ${pick("month")} ${pick("year")}, ${pick("weekday")}`;
}

function airportLine(city: string, code: string, fallbackCity?: string, terminal?: string) {
  const entry = getAirportDisplay(code, fallbackCity || city);
  const name = entry.airportLine.includes(" - ")
    ? entry.airportLine.split(" - ").slice(1).join(" - ")
    : `${entry.city} Airport`;
  return `${entry.city}, ${name}${terminal ? ` - ${terminal}` : ""}`;
}

function formatEndpoint(seg: FlightSegment, kind: "departure" | "arrival") {
  const isDep = kind === "departure";
  const at = isDep ? seg.departureAt : seg.arrivalAt;
  if (!at) return "—";
  const city = isDep ? seg.fromCity : seg.toCity;
  const code = isDep ? seg.fromAirport : seg.toAirport;
  const terminal = isDep ? seg.departureTerminal : seg.terminal;
  return `${formatVoucherDateTime(at)} - ${airportLine(city, code, city, terminal)}`;
}

function paxTypeLabel(type?: string) {
  if (type === "child") return "Child";
  if (type === "infant") return "Infant";
  return "Adult";
}

function cabinLabel(cabin?: CabinClass | null) {
  if (cabin === "BUSINESS") return "Business";
  if (cabin === "PREMIUM_ECONOMY") return "Premium Economy";
  return "Economy";
}

function formatInr(amount: number) {
  // Helvetica in react-pdf renders ₹ as a broken superscript — use Rs.
  return `Rs. ${amount.toLocaleString("en-IN", { minimumFractionDigits: 1, maximumFractionDigits: 2 })}`;
}

function layoverLabel(seg: FlightSegment, next: FlightSegment) {
  const raw = seg.layoverDuration || computeLayoverDuration(seg.arrivalAt, next.departureAt);
  if (!raw) return "Stop : Layover";
  return `Stop : ${raw} Layover`;
}

function formatCabinBaggageLine(handBaggage?: string) {
  if (!handBaggage?.trim()) return null;
  const preset = handBaggage.trim().match(/^(\d+)\s*KG$/i);
  if (preset) return `1 piece X ${preset[1]} kg cabin baggage`;
  return handBaggage.trim();
}

function baggageLines(pax: FlightPassenger) {
  const lines: string[] = [];
  const cabin = formatCabinBaggageLine(pax.handBaggage);
  if (cabin) lines.push(cabin);
  if (pax.checkInBaggage) lines.push(pax.checkInBaggage);
  else lines.push("1 piece X 15 kg checked baggage");
  return lines;
}

function groupSegments(segments: FlightSegment[], tripType?: string | null) {
  if (tripType !== "ROUND_TRIP" || segments.length < 2) {
    const from = segments[0]?.fromCity || segments[0]?.fromAirport || "";
    const to = segments[segments.length - 1]?.toCity || segments[segments.length - 1]?.toAirport || "";
    return [{ label: `Departure: ${from}-${to}`, segments }];
  }
  const outbound = segments.filter((s, i) => s.direction === "outbound" || i === 0);
  const ret = segments.filter((s, i) => s.direction === "return" || (i > 0 && s.direction !== "outbound"));
  const groups: { label: string; segments: FlightSegment[] }[] = [];
  if (outbound.length) {
    const o = outbound;
    groups.push({
      label: `Departure: ${o[0].fromCity || o[0].fromAirport}-${o[o.length - 1].toCity || o[o.length - 1].toAirport}`,
      segments: o,
    });
  }
  if (ret.length) {
    const r = ret;
    groups.push({
      label: `Return: ${r[0].fromCity || r[0].fromAirport}-${r[r.length - 1].toCity || r[r.length - 1].toAirport}`,
      segments: r,
    });
  }
  return groups.length ? groups : [{ label: "Departure", segments }];
}

function AgencyHeader({ agency, logoSrc }: { agency: AgencySettings; logoSrc?: string | null }) {
  const cityLine = [agency.city, agency.state, agency.pincode].filter(Boolean).join(", ");

  return (
    <View style={styles.headerRow}>
      <PdfLogo src={logoSrc} variant="voucher" />
      <View style={styles.agencyBlock}>
        <Text style={styles.agencyName}>{agency.companyName}</Text>
        {agency.address ? <Text style={styles.agencyLine}>{agency.address}</Text> : null}
        {cityLine ? <Text style={styles.agencyLine}>{cityLine}</Text> : null}
        {agency.phone ? <Text style={styles.agencyLine}>{agency.phone}</Text> : null}
        {agency.email ? <Text style={styles.agencyLine}>{agency.email}</Text> : null}
      </View>
    </View>
  );
}

interface Props {
  agency: AgencySettings;
  booking: Booking;
  flight: FlightBooking;
  segments: FlightSegment[];
  passengers: FlightPassenger[];
  logoSrc?: string | null;
  airlineLogoSrc?: string | null;
  segmentAirlineLogoSrcs?: (string | null)[];
}

function FlightSegmentBlock({
  seg,
  airlineLogoSrc,
  flightAirline,
  cabinClass,
}: {
  seg: FlightSegment;
  airlineLogoSrc?: string | null;
  flightAirline: string;
  cabinClass: CabinClass;
}) {
  const airline = resolveSegmentAirline(seg, flightAirline);
  return (
    <View style={styles.legBlock}>
      <View style={styles.flightRow}>
        <View style={styles.flightCol}>
          <Text style={styles.flightColLabel}>Airline</Text>
          <View style={styles.airlineRow}>
            {airlineLogoSrc ? <Image src={airlineLogoSrc} style={styles.airlineLogo} /> : null}
            <Text style={styles.flightColValue}>{airline}</Text>
          </View>
        </View>
        <View style={styles.flightCol}>
          <Text style={styles.flightColLabel}>Flight Number</Text>
          <Text style={styles.flightColValue}>{seg.flightNumber || "—"}</Text>
        </View>
        <View style={styles.flightCol}>
          <Text style={styles.flightColLabel}>Class</Text>
          <Text style={styles.flightColValue}>{cabinLabel(cabinClass)}</Text>
        </View>
      </View>
      <Text style={styles.timeLine}>
        <Text style={{ fontFamily: "Helvetica-Bold" }}>Departure: </Text>
        {formatEndpoint(seg, "departure")}
      </Text>
      <Text style={styles.timeLine}>
        <Text style={{ fontFamily: "Helvetica-Bold" }}>Arrival: </Text>
        {formatEndpoint(seg, "arrival")}
      </Text>
    </View>
  );
}

export function FlightTicketPDF({
  agency,
  booking,
  flight,
  segments,
  passengers,
  logoSrc,
  airlineLogoSrc,
  segmentAirlineLogoSrcs,
}: Props) {
  const pnr = booking.pnr || "—";
  const baseFare = Number(flight.baseFare || 0);
  const taxes = Number(flight.cgstAmount || 0) + Number(flight.sgstAmount || 0) + Number(flight.igstAmount || 0);
  const discount = Number(flight.discountAmount || 0);
  const total = Number(booking.totalAmount);
  const serviceCharge = Number(flight.serviceCharge || 0);
  const priceBeforeTax = baseFare + serviceCharge;
  const segmentGroups = groupSegments(segments, flight.tripType);
  const terms = getVoucherTermsContent(agency.companyName);
  const isAddon = flight.tripType === "ADDON_SERVICES";
  const addonLines = isAddon
    ? addonDetailLines(flight.addonType, flight.addonCustomLabel, flight.addonCustomValue, passengers)
    : [];

  return (
    <Document>
      {passengers.map((pax, pIdx) => (
        <React.Fragment key={`pax-${pIdx}`}>
          <Page size="A4" style={styles.page}>
            <AgencyHeader agency={agency} logoSrc={logoSrc} />
            <Text style={styles.sectionTitle}>Traveler Details</Text>
            <View style={styles.detailGrid}>
              <View style={styles.detailCell}>
                <Text style={styles.detailLabel}>Traveler</Text>
                <Text style={styles.detailValue}>
                  {pax.title} {pax.firstName} {pax.lastName} ({paxTypeLabel(pax.paxType)})
                </Text>
              </View>
              <View style={styles.detailCell}>
                <Text style={styles.detailLabel}>Ticket Number</Text>
                <Text style={styles.detailValue}>{pax.ticketNumber || "—"}</Text>
              </View>
              <View style={styles.detailCell}>
                <Text style={styles.detailLabel}>PNR Code</Text>
                <Text style={styles.detailValue}>{pnr}</Text>
              </View>
              <View style={styles.detailCell}>
                <Text style={styles.detailLabel}>Date of Birth</Text>
                <Text style={styles.detailValue}>—</Text>
              </View>
            </View>
            <Text style={styles.sectionTitle}>{isAddon ? "Add-on Service Details" : "Flight Details"}</Text>
            {isAddon ? (
              <View style={{ marginBottom: 14 }}>
                <View style={styles.flightRow}>
                  <View style={styles.flightCol}>
                    <Text style={styles.flightColLabel}>Airline</Text>
                    <View style={styles.airlineRow}>
                      {airlineLogoSrc ? <Image src={airlineLogoSrc} style={styles.airlineLogo} /> : null}
                      <Text style={styles.flightColValue}>{flight.airline}</Text>
                    </View>
                  </View>
                  {pax.seat?.trim() ? (
                    <View style={styles.flightCol}>
                      <Text style={styles.flightColLabel}>Seat</Text>
                      <Text style={styles.flightColValue}>{pax.seat.trim()}</Text>
                    </View>
                  ) : null}
                </View>
                <Text style={styles.timeLine}>
                  <Text style={{ fontFamily: "Helvetica-Bold" }}>Service: </Text>
                  {addonTypeLabel(flight.addonType, flight.addonCustomLabel)}
                </Text>
                {segments[0]?.flightNumber && segments[0].flightNumber !== "ADDON" ? (
                  <Text style={styles.timeLine}>
                    <Text style={{ fontFamily: "Helvetica-Bold" }}>Reference Flight: </Text>
                    {segments[0].flightNumber}
                  </Text>
                ) : null}
                {addonLines.map((line) => (
                  <Text key={line} style={styles.timeLine}>
                    {line}
                  </Text>
                ))}
              </View>
            ) : (
            segmentGroups.map((group, gIdx) => (
              <View key={`grp-${gIdx}`} style={{ marginBottom: 8 }}>
                <Text style={styles.departureHeading}>{group.label}</Text>
                {group.segments.map((seg, sIdx) => {
                  const flatIdx = segments.indexOf(seg);
                  const segLogo =
                    segmentAirlineLogoSrcs?.[flatIdx >= 0 ? flatIdx : sIdx] ?? airlineLogoSrc;
                  return (
                  <React.Fragment key={`seg-${sIdx}`}>
                    <FlightSegmentBlock
                      seg={seg}
                      airlineLogoSrc={segLogo}
                      flightAirline={flight.airline}
                      cabinClass={flight.cabinClass}
                    />
                    {sIdx < group.segments.length - 1 ? (
                      <View style={styles.layoverRow}>
                        <View style={styles.layoverLine} />
                        <Text style={styles.layoverText}>{layoverLabel(seg, group.segments[sIdx + 1])}</Text>
                        <View style={styles.layoverLine} />
                      </View>
                    ) : null}
                  </React.Fragment>
                  );
                })}
              </View>
            ))
            )}
            {!isAddon && (
            <>
            <Text style={styles.sectionTitle}>Baggage Details</Text>
            <View style={styles.baggageGrid}>
              <View style={styles.baggageCol}>
                <Text style={styles.detailLabel}>Traveler Name Surname</Text>
                <Text style={styles.detailValue}>
                  {pax.firstName} {pax.lastName} ({paxTypeLabel(pax.paxType)})
                </Text>
              </View>
              <View style={styles.baggageCol}>
                <Text style={styles.detailLabel}>Departure Baggage Allowance</Text>
                {baggageLines(pax).map((line, i) => (
                  <Text key={`bag-${i}`} style={styles.detailValue}>
                    {line}
                  </Text>
                ))}
              </View>
            </View>
            </>
            )}
            <Text style={styles.sectionTitle}>Payment Information</Text>
            <View style={styles.paymentBox}>
              <View style={styles.paymentRow}>
                <Text>Price</Text>
                <Text>{formatInr(priceBeforeTax)}</Text>
              </View>
              <View style={styles.paymentRow}>
                <Text>Taxes</Text>
                <Text>{formatInr(taxes)}</Text>
              </View>
              {discount > 0 ? (
                <View style={styles.paymentRow}>
                  <Text>Special Discount</Text>
                  <Text>-{formatInr(discount)}</Text>
                </View>
              ) : null}
              <View style={styles.paymentTotalRow}>
                <Text style={styles.paymentTotal}>Total {formatInr(total)}</Text>
              </View>
            </View>
            <Text style={styles.footerNote}>
              Note: This is not an invoice. Your invoice will be sent within 7 days.
            </Text>
          </Page>
          <Page size="A4" style={styles.page}>
            <AgencyHeader agency={agency} logoSrc={logoSrc} />
            <Text style={styles.termsTitle}>{terms.title}</Text>
            <Text style={styles.termsIntro}>{terms.intro}</Text>
            {terms.sections.map((section, i) => (
              <View key={`term-${i}`}>
                <Text style={styles.termsSectionHeading}>{section.heading}</Text>
                {section.paragraphs?.map((p, j) => (
                  <Text key={`tp-${j}`} style={styles.termsParagraph}>
                    {p}
                  </Text>
                ))}
                {section.items?.map((item, j) => (
                  <Text key={`ti-${j}`} style={styles.termsItem}>
                    <Text style={styles.termsItemLabel}>{item.label} </Text>
                    {item.text}
                  </Text>
                ))}
              </View>
            ))}
            <Text style={styles.termsClosing}>{terms.closing}</Text>
          </Page>
        </React.Fragment>
      ))}
    </Document>
  );
}
