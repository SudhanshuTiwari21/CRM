import React from "react";
import {
  Circle,
  Document,
  Defs,
  Image,
  LinearGradient,
  Page,
  Path,
  Rect,
  Stop,
  Svg,
  Text,
  View,
  StyleSheet,
} from "@react-pdf/renderer";
import type { AgencySettings, Booking, Customer, FlightBooking } from "@prisma/client";
import type { CabinClass } from "@prisma/client";
import type { FlightPassenger, FlightSegment } from "@/types/booking";
import { resolveSegmentAirline } from "@/lib/airline-logo";
import { PdfLogo } from "@/templates/pdf/pdf-logo";
import { getVoucherTermsContent } from "@/templates/pdf/voucher-terms";
import { addonDetailLines, addonTypeLabel } from "@/lib/flight-addon";
import { formatPassportDate } from "@/lib/passport-dates";
import {
  baggageLines,
  cabinClassDisplay,
  formatEndpoint,
  formatPdfInr,
  formatVoucherDob,
  groupSegments,
  layoverLabel,
  paxTypeLabel,
  travelerDisplayName,
  voucherPaymentBreakdown,
  WINGIE_COLORS,
} from "@/lib/voucher-format";

const C = WINGIE_COLORS;
const HEADER_BG = "#eef2f6";

const styles = StyleSheet.create({
  page: {
    paddingTop: 32,
    paddingBottom: 36,
    paddingHorizontal: 40,
    fontSize: 8,
    fontFamily: "Helvetica",
    color: C.navy,
    backgroundColor: "#fff",
    lineHeight: 1.45,
  },
  headerBand: {
    marginHorizontal: -40,
    marginTop: -32,
    marginBottom: 16,
    backgroundColor: HEADER_BG,
    paddingHorizontal: 40,
    paddingTop: 26,
    paddingBottom: 0,
  },
  headerFade: {
    height: 16,
    width: "100%",
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingBottom: 10,
  },
  agencyBlock: { alignItems: "flex-end", maxWidth: 220, flexShrink: 0 },
  agencyName: {
    fontSize: 7,
    fontFamily: "Helvetica-Bold",
    color: C.navy,
    lineHeight: 1.55,
    textAlign: "right",
  },
  agencyLine: { fontSize: 6.5, color: C.label, lineHeight: 1.55, textAlign: "right" },
  sectionTitle: {
    fontSize: 11.5,
    fontFamily: "Helvetica-Bold",
    color: C.navy,
    marginBottom: 10,
    marginTop: 2,
  },
  detailGrid: { flexDirection: "row", flexWrap: "wrap", marginBottom: 16 },
  detailCell: { width: "25%", marginBottom: 8, paddingRight: 6 },
  detailCellRight: { width: "25%", marginBottom: 8, paddingRight: 6, alignItems: "flex-end" },
  detailLabel: { fontSize: 7.5, color: C.label, marginBottom: 3 },
  detailLabelRight: { fontSize: 7.5, color: C.label, marginBottom: 3, textAlign: "right" },
  detailValue: { fontSize: 8, color: C.text },
  detailValueRight: { fontSize: 8, color: C.text, textAlign: "right" },
  flightSectionTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 8,
    marginTop: 2,
  },
  flightSectionTitle: {
    fontSize: 11.5,
    fontFamily: "Helvetica-Bold",
    color: C.navy,
  },
  flightHighlight: {
    backgroundColor: "#f0f6fb",
    borderWidth: 1,
    borderColor: "#c5d8e8",
    borderLeftWidth: 3,
    borderLeftColor: C.navy,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 14,
  },
  departureHeading: { fontFamily: "Helvetica-Bold", fontSize: 8, marginBottom: 8, color: C.navy },
  flightRow: { flexDirection: "row", marginBottom: 6 },
  flightCol: { width: "33%" },
  flightColLabel: { fontSize: 7.5, color: C.label, marginBottom: 3 },
  flightColValue: { fontSize: 8, color: C.text },
  airlineRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  airlineLogo: { width: 16, height: 16, objectFit: "contain" as const },
  legBlock: { marginBottom: 10 },
  eventRow: { flexDirection: "row", alignItems: "flex-start", marginBottom: 5, gap: 7 },
  eventIconWrap: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: "#dceaf4",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 0,
  },
  eventText: { flex: 1, fontSize: 8, color: C.text, lineHeight: 1.4, paddingTop: 1 },
  eventLabel: { fontFamily: "Helvetica-Bold", color: C.navy },
  timeLine: { fontSize: 8, marginBottom: 3, color: C.text },
  routeVisual: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 2,
    marginBottom: 8,
    paddingLeft: 2,
    gap: 4,
  },
  routeDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: C.navy },
  routeTrack: { flex: 1, height: 1.5, backgroundColor: "#9bb8d0" },
  layoverRow: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 8,
    gap: 6,
    backgroundColor: "#e8f0f6",
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderRadius: 3,
  },
  layoverLine: { flex: 1, borderTopWidth: 1, borderTopColor: "#9bb8d0", borderStyle: "dashed" },
  layoverText: { fontSize: 7, color: C.navy, paddingHorizontal: 4, fontFamily: "Helvetica-Bold" },
  baggageGrid: { flexDirection: "row", marginBottom: 14 },
  baggageCol: { width: "50%", paddingRight: 12 },
  baggageLine: { fontSize: 8, color: C.text, marginBottom: 2 },
  paymentBox: {
    backgroundColor: C.paymentBg,
    padding: 12,
    paddingBottom: 10,
    marginTop: 2,
    marginBottom: 10,
  },
  paymentRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 5, fontSize: 8, color: C.text },
  paymentAmount: { fontFamily: "Times-Roman", fontSize: 8, color: C.text },
  paymentTotalRow: { flexDirection: "row", justifyContent: "flex-end", marginTop: 4 },
  paymentTotal: { fontSize: 11.5, fontFamily: "Helvetica-Bold", color: C.navy },
  footerNoteRow: { flexDirection: "row", alignItems: "flex-start", gap: 4, marginTop: 4 },
  footerIcon: {
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: C.muted,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
  },
  footerIconText: { fontSize: 5.5, color: C.muted },
  footerNote: { fontSize: 6.5, color: C.muted, flex: 1, lineHeight: 1.4 },
  termsBorder: {
    borderWidth: 1,
    borderColor: C.termsBorder,
    padding: 18,
    marginTop: 4,
  },
  termsTitle: { fontSize: 13, fontFamily: "Helvetica-Bold", marginBottom: 8, color: C.navy },
  termsIntro: { fontSize: 8, marginBottom: 12, color: C.text },
  termsSectionHeading: { fontFamily: "Helvetica-Bold", fontSize: 8, marginTop: 10, marginBottom: 5, color: C.navy },
  termsParagraph: { fontSize: 7.5, marginBottom: 6, color: C.text, lineHeight: 1.5, fontFamily: "Times-Roman" },
  policyText: { fontSize: 7.5, color: "#4b5563", lineHeight: 1.45, marginBottom: 12 },
  termsItem: { fontSize: 7.5, marginBottom: 5, color: C.text, lineHeight: 1.5, fontFamily: "Times-Roman" },
  termsItemLabel: { fontFamily: "Helvetica-Bold" },
  termsClosing: { fontFamily: "Helvetica-Bold", fontSize: 8.5, marginTop: 14, color: C.navy },
});

function IconTakeoff() {
  return (
    <Svg width={10} height={10} viewBox="0 0 24 24">
      <Path
        d="M2.5 19h19v2h-19v-2zm19.57-9.36c-.21-.8-1.04-1.28-1.84-1.06L14.92 10l-6.9-6.43-1.93.51 4.14 7.17-4.97 1.33-1.97-1.54-1.45.39 2.59 4.49.77 1.33 1.6-.43 5.23-1.4 5.32-1.42c.8-.22 1.28-1.04 1.06-1.84z"
        fill={C.navy}
      />
    </Svg>
  );
}

function IconLanding() {
  return (
    <Svg width={10} height={10} viewBox="0 0 24 24">
      <Path
        d="M2.5 19h19v2h-19v-2zm7.18-5.73l4.35 1.16 5.31 1.42c.8.21 1.62-.26 1.84-1.06.21-.8-.26-1.62-1.06-1.84l-5.31-1.42-2.76-9.03-1.93-.51v8.28L5.15 8.95l-.93-2.28-1.45.39 2.59 4.49.77 1.33 1.6-.43.9-.24z"
        fill={C.navy}
      />
    </Svg>
  );
}

function IconPlane() {
  return (
    <Svg width={12} height={12} viewBox="0 0 24 24">
      <Path
        d="M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z"
        fill={C.navy}
      />
    </Svg>
  );
}

function IconStop() {
  return (
    <Svg width={10} height={10} viewBox="0 0 24 24">
      <Circle cx={12} cy={12} r={7.5} stroke={C.navy} strokeWidth={2} fill="none" />
      <Path d="M8 12h8" stroke={C.navy} strokeWidth={2} />
    </Svg>
  );
}

function EventIcon({ children }: { children: React.ReactNode }) {
  return <View style={styles.eventIconWrap}>{children}</View>;
}

function VoucherHeaderBand({
  agency,
  logoSrc,
  fadeId,
}: {
  agency: AgencySettings;
  logoSrc?: string | null;
  fadeId: string;
}) {
  const cityLine = [agency.city, agency.state, agency.pincode].filter(Boolean).join(", ");

  return (
    <View style={styles.headerBand}>
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
      <Svg style={styles.headerFade} viewBox="0 0 515 16">
        <Defs>
          <LinearGradient id={fadeId}>
            <Stop offset="0%" stopColor={HEADER_BG} />
            <Stop offset="55%" stopColor="#f7f9fb" />
            <Stop offset="100%" stopColor="#ffffff" />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="515" height="16" fill={`url(#${fadeId})`} />
      </Svg>
    </View>
  );
}

interface Props {
  agency: AgencySettings;
  booking: Booking;
  flight: FlightBooking;
  customer: Pick<Customer, "name" | "phone" | "email" | "pan" | "gstin" | "address" | "city" | "state" | "pincode">;
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
          <Text style={styles.flightColValue}>{seg.flightNumber || "-"}</Text>
        </View>
        <View style={styles.flightCol}>
          <Text style={styles.flightColLabel}>Class</Text>
          <Text style={styles.flightColValue}>{cabinClassDisplay(cabinClass)}</Text>
        </View>
      </View>

      <View style={styles.routeVisual}>
        <View style={styles.routeDot} />
        <View style={styles.routeTrack} />
        <IconPlane />
        <View style={styles.routeTrack} />
        <View style={styles.routeDot} />
      </View>

      <View style={styles.eventRow}>
        <EventIcon>
          <IconTakeoff />
        </EventIcon>
        <Text style={styles.eventText}>
          <Text style={styles.eventLabel}>Departure: </Text>
          {formatEndpoint(seg, "departure")}
        </Text>
      </View>
      <View style={styles.eventRow}>
        <EventIcon>
          <IconLanding />
        </EventIcon>
        <Text style={styles.eventText}>
          <Text style={styles.eventLabel}>Arrival: </Text>
          {formatEndpoint(seg, "arrival")}
        </Text>
      </View>
    </View>
  );
}

function PaymentAmount({ amount, negative }: { amount: number; negative?: boolean }) {
  const text = negative ? `-${formatPdfInr(amount)}` : formatPdfInr(amount);
  return <Text style={styles.paymentAmount}>{text}</Text>;
}

export function FlightTicketPDF({
  agency,
  booking,
  flight,
  customer: _customer,
  segments,
  passengers,
  logoSrc,
  airlineLogoSrc,
  segmentAirlineLogoSrcs,
}: Props) {
  void _customer;
  const pnr = booking.pnr || "-";
  const baseFare = Number(flight.baseFare || 0);
  const taxes = Number(flight.cgstAmount || 0) + Number(flight.sgstAmount || 0) + Number(flight.igstAmount || 0);
  const discount = Number(flight.discountAmount || 0);
  const total = Number(booking.totalAmount);
  const serviceCharge = Number(flight.serviceCharge || 0);
  const payment = voucherPaymentBreakdown({ baseFare, serviceCharge, taxes, discount, total });
  const segmentGroups = groupSegments(segments, flight.tripType);
  const terms = getVoucherTermsContent(agency.companyName);
  const isAddon = flight.tripType === "ADDON_SERVICES";
  const showInternationalDetails = Boolean(flight.showEticket);
  const addonLines = isAddon
    ? addonDetailLines(flight.addonType, flight.addonCustomLabel, flight.addonCustomValue, passengers)
    : [];

  return (
    <Document>
      {passengers.map((pax, pIdx) => (
        <React.Fragment key={`pax-${pIdx}`}>
          <Page size="A4" style={styles.page}>
            <VoucherHeaderBand agency={agency} logoSrc={logoSrc} fadeId={`hdr-fade-${pIdx}-main`} />

            <Text style={styles.sectionTitle}>Traveler Details</Text>
            <View style={styles.detailGrid}>
              <View style={styles.detailCell}>
                <Text style={styles.detailLabel}>Traveler</Text>
                <Text style={styles.detailValue}>
                  {travelerDisplayName(pax)} ({paxTypeLabel(pax.paxType)})
                </Text>
              </View>
              <View style={styles.detailCell}>
                <Text style={styles.detailLabel}>Ticket Number</Text>
                <Text style={styles.detailValue}>{pax.ticketNumber || "-"}</Text>
              </View>
              <View style={styles.detailCell}>
                <Text style={styles.detailLabel}>Airline (PNR)</Text>
                <Text style={styles.detailValue}>{pnr}</Text>
              </View>
              <View style={styles.detailCellRight}>
                <Text style={styles.detailLabelRight}>Date of Birth</Text>
                <Text style={styles.detailValueRight}>{formatVoucherDob(pax.dateOfBirth)}</Text>
              </View>
              {showInternationalDetails || pax.passportNumber ? (
                <>
                  <View style={styles.detailCell}>
                    <Text style={styles.detailLabel}>Passport No</Text>
                    <Text style={styles.detailValue}>{pax.passportNumber || "-"}</Text>
                  </View>
                  <View style={styles.detailCell}>
                    <Text style={styles.detailLabel}>Passport Country</Text>
                    <Text style={styles.detailValue}>{pax.passportIssuingCountry || "-"}</Text>
                  </View>
                  <View style={styles.detailCell}>
                    <Text style={styles.detailLabel}>Passport Issue</Text>
                    <Text style={styles.detailValue}>{formatPassportDate(pax.passportIssueDate)}</Text>
                  </View>
                  <View style={styles.detailCellRight}>
                    <Text style={styles.detailLabelRight}>Passport Expiry</Text>
                    <Text style={styles.detailValueRight}>{formatPassportDate(pax.passportExpiryDate)}</Text>
                  </View>
                </>
              ) : null}
            </View>

            <View style={styles.flightSectionTitleRow}>
              <IconPlane />
              <Text style={styles.flightSectionTitle}>
                {isAddon ? "Add-on Service Details" : "Flight Details"}
              </Text>
            </View>
            <View style={styles.flightHighlight}>
              {isAddon ? (
                <View>
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
                  <Text style={styles.timeLine}>Service: {addonTypeLabel(flight.addonType, flight.addonCustomLabel)}</Text>
                  {segments[0]?.flightNumber && segments[0].flightNumber !== "ADDON" ? (
                    <Text style={styles.timeLine}>Reference Flight: {segments[0].flightNumber}</Text>
                  ) : null}
                  {addonLines.map((line) => (
                    <Text key={line} style={styles.timeLine}>
                      {line}
                    </Text>
                  ))}
                </View>
              ) : (
                segmentGroups.map((group, gIdx) => (
                  <View key={`grp-${gIdx}`} style={{ marginBottom: gIdx < segmentGroups.length - 1 ? 6 : 0 }}>
                    <Text style={styles.departureHeading}>{group.label}</Text>
                    {group.segments.map((seg, sIdx) => {
                      const flatIdx = segments.indexOf(seg);
                      const segLogo = segmentAirlineLogoSrcs?.[flatIdx >= 0 ? flatIdx : sIdx] ?? airlineLogoSrc;
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
                              <EventIcon>
                                <IconStop />
                              </EventIcon>
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
            </View>

            {!isAddon && (
              <>
                <Text style={styles.sectionTitle}>Baggage Details</Text>
                <View style={styles.baggageGrid}>
                  <View style={styles.baggageCol}>
                    <Text style={styles.detailLabel}>Traveler Name Surname</Text>
                    <Text style={styles.detailValue}>
                      {travelerDisplayName(pax)} ({paxTypeLabel(pax.paxType)})
                    </Text>
                  </View>
                  <View style={styles.baggageCol}>
                    <Text style={styles.detailLabel}>Departure Baggage Allowance</Text>
                    {baggageLines(pax).map((line, i) => (
                      <Text key={`bag-${i}`} style={styles.baggageLine}>
                        • {line}
                      </Text>
                    ))}
                  </View>
                </View>
              </>
            )}

            {flight.includeCancellationPolicy && flight.cancellationPolicy && (
              <>
                <Text style={styles.sectionTitle}>Cancellation Policy</Text>
                <Text style={styles.policyText}>{flight.cancellationPolicy}</Text>
              </>
            )}

            <Text style={styles.sectionTitle}>Payment Information</Text>
            <View style={styles.paymentBox}>
              <View style={styles.paymentRow}>
                <Text>Price</Text>
                <PaymentAmount amount={payment.price} />
              </View>
              <View style={styles.paymentRow}>
                <Text>Taxes</Text>
                <PaymentAmount amount={payment.taxes} />
              </View>
              {discount > 0 ? (
                <View style={styles.paymentRow}>
                  <Text>Special Discount</Text>
                  <PaymentAmount amount={payment.discount} negative />
                </View>
              ) : null}
              <View style={styles.paymentTotalRow}>
                <Text style={styles.paymentTotal}>Total {formatPdfInr(payment.total)}</Text>
              </View>
            </View>

            <View style={styles.footerNoteRow}>
              <View style={styles.footerIcon}>
                <Text style={styles.footerIconText}>i</Text>
              </View>
              <Text style={styles.footerNote}>
                Please keep this e-ticket for your travel records.
              </Text>
            </View>
          </Page>

          <Page size="A4" style={styles.page}>
            <VoucherHeaderBand agency={agency} logoSrc={logoSrc} fadeId={`hdr-fade-${pIdx}-terms`} />
            <View style={styles.termsBorder}>
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
            </View>
          </Page>
        </React.Fragment>
      ))}
    </Document>
  );
}
