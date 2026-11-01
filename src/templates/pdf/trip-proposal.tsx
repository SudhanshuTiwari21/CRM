import React from "react";
import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import type { AgencySettings, TripPlan, TripPlanItem, Lead } from "@prisma/client";
import { format } from "date-fns";
import { PdfLogo } from "@/templates/pdf/pdf-logo";
import { brandUsesSquareLogo } from "@/lib/branding";
import { TRIP_SERVICE_TYPE_LABELS } from "@/lib/constants/trip-plan";
import { WINGIE_COLORS } from "@/lib/voucher-format";

const C = WINGIE_COLORS;
const HEADER_BG = "#eef2f6";
const ACCENT = "#1e3a8a";
const ACCENT_SOFT = "#f0f6fb";

const styles = StyleSheet.create({
  page: {
    paddingTop: 32,
    paddingBottom: 44,
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
    marginBottom: 16,
    backgroundColor: HEADER_BG,
    paddingHorizontal: 36,
    paddingTop: 22,
    paddingBottom: 16,
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

  docBadge: {
    alignSelf: "flex-start",
    backgroundColor: ACCENT,
    borderRadius: 3,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginBottom: 8,
  },
  docBadgeText: {
    fontSize: 7,
    fontFamily: "Helvetica-Bold",
    color: "#fff",
    letterSpacing: 0.8,
  },
  tripTitle: {
    fontSize: 16,
    fontFamily: "Helvetica-Bold",
    color: ACCENT,
    marginBottom: 4,
    lineHeight: 1.3,
  },
  tripSubtitle: { fontSize: 9, color: C.text, marginBottom: 10 },

  metaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 14,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  metaCol: { flex: 1, paddingRight: 8 },
  metaLabel: {
    fontSize: 7,
    color: C.label,
    marginBottom: 3,
    textTransform: "uppercase",
  },
  metaValue: { fontSize: 9, fontFamily: "Helvetica-Bold", color: C.navy },

  summaryRow: { flexDirection: "row", gap: 8, marginBottom: 16 },
  summaryCard: {
    flex: 1,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 4,
    paddingVertical: 9,
    paddingHorizontal: 10,
    backgroundColor: "#fff",
  },
  summaryLabel: {
    fontSize: 7,
    color: C.label,
    textTransform: "uppercase",
    marginBottom: 3,
  },
  summaryValue: { fontSize: 9, fontFamily: "Helvetica-Bold", color: C.navy },

  guestCard: {
    backgroundColor: ACCENT_SOFT,
    borderWidth: 1,
    borderColor: "#c5d8e8",
    borderLeftWidth: 3,
    borderLeftColor: ACCENT,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 16,
  },
  guestTitle: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    color: ACCENT,
    marginBottom: 6,
    textTransform: "uppercase",
  },
  guestRow: { flexDirection: "row", marginBottom: 3 },
  guestLabel: { width: 72, fontSize: 8, color: C.label },
  guestValue: { flex: 1, fontSize: 8.5, color: C.text },

  sectionTitle: {
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    color: ACCENT,
    marginBottom: 10,
    marginTop: 2,
  },

  dayBlock: { marginBottom: 12 },
  dayHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 6,
    gap: 8,
  },
  dayPill: {
    backgroundColor: ACCENT,
    borderRadius: 10,
    paddingHorizontal: 9,
    paddingVertical: 3,
  },
  dayPillText: { fontSize: 8, fontFamily: "Helvetica-Bold", color: "#fff" },
  dayLine: { flex: 1, height: 1, backgroundColor: C.border },

  itemBox: {
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 4,
    padding: 10,
    marginBottom: 6,
    marginLeft: 4,
  },
  itemTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 3,
    gap: 8,
  },
  itemTitle: { fontSize: 9, fontFamily: "Helvetica-Bold", color: C.navy, flex: 1 },
  serviceChip: {
    backgroundColor: HEADER_BG,
    borderRadius: 8,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  serviceChipText: { fontSize: 7, fontFamily: "Helvetica-Bold", color: C.navy },
  itemMeta: { fontSize: 7.5, color: C.label, marginBottom: 3 },
  itemDesc: { fontSize: 8, color: C.text, lineHeight: 1.4 },

  table: {
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 4,
    overflow: "hidden",
    marginBottom: 10,
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: HEADER_BG,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#eef2f6",
  },
  th: {
    paddingVertical: 7,
    paddingHorizontal: 6,
    fontSize: 7.5,
    fontFamily: "Helvetica-Bold",
    color: C.label,
    textTransform: "uppercase",
  },
  td: { paddingVertical: 7, paddingHorizontal: 6, fontSize: 8, color: C.text },
  colService: { width: "20%" },
  colDesc: { width: "40%" },
  colQty: { width: "10%", textAlign: "right" },
  colAmount: { width: "15%", textAlign: "right" },
  colTotal: { width: "15%", textAlign: "right" },

  totalBox: {
    backgroundColor: "#f0fdf4",
    borderWidth: 1,
    borderColor: "#86efac",
    borderRadius: 4,
    paddingVertical: 12,
    paddingHorizontal: 14,
    alignItems: "flex-end",
    marginBottom: 14,
  },
  totalGst: { fontSize: 8, color: C.text, marginBottom: 4 },
  offerPrice: { fontSize: 14, fontFamily: "Helvetica-Bold", color: "#166534" },
  currencyNote: { fontSize: 7.5, color: C.label, marginTop: 3 },

  twoCol: { flexDirection: "row", gap: 10, marginBottom: 12 },
  halfCard: {
    flex: 1,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 4,
    padding: 10,
  },
  halfTitle: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    color: ACCENT,
    marginBottom: 6,
  },
  bullet: { fontSize: 8, color: C.text, marginBottom: 3, lineHeight: 1.4 },

  termsBox: {
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 4,
    padding: 10,
    marginBottom: 8,
  },
  termsTitle: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    color: ACCENT,
    marginBottom: 6,
  },

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

function inr(n: number) {
  return `Rs. ${n.toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

function fmtDate(d?: Date | null) {
  if (!d) return "—";
  return format(new Date(d), "dd MMM yyyy");
}

function paxLabel(plan: TripPlan) {
  const parts: string[] = [];
  if (plan.adultCount) parts.push(`${plan.adultCount} Adult${plan.adultCount > 1 ? "s" : ""}`);
  if (plan.childCount) parts.push(`${plan.childCount} Child${plan.childCount > 1 ? "ren" : ""}`);
  if (plan.infantCount) parts.push(`${plan.infantCount} Infant${plan.infantCount > 1 ? "s" : ""}`);
  return parts.length ? parts.join(", ") : "—";
}

function groupByDay(items: TripPlanItem[]) {
  const map = new Map<number, TripPlanItem[]>();
  for (const item of items) {
    const list = map.get(item.dayNumber) || [];
    list.push(item);
    map.set(item.dayNumber, list);
  }
  return [...map.entries()].sort(([a], [b]) => a - b);
}

function splitLines(text?: string | null) {
  if (!text?.trim()) return [];
  return text
    .split("\n")
    .map((line) => line.replace(/^[-•]\s*/, "").trim())
    .filter(Boolean);
}

interface Props {
  agency: AgencySettings;
  plan: TripPlan;
  lead: Pick<Lead, "name" | "queryRef" | "phone" | "email">;
  items: TripPlanItem[];
  logoSrc?: string | null;
}

export function TripProposalPDF({ agency, plan, lead, items, logoSrc }: Props) {
  const days = groupByDay(items);
  const square = brandUsesSquareLogo(agency.companyName);
  const nights =
    plan.durationDays && plan.durationDays > 0
      ? Math.max(0, plan.durationDays - 1)
      : plan.travelDate && plan.returnDate
        ? Math.max(
            0,
            Math.round(
              (new Date(plan.returnDate).getTime() - new Date(plan.travelDate).getTime()) /
                (1000 * 60 * 60 * 24)
            )
          )
        : null;
  const inclusions = splitLines(plan.inclusions);
  const exclusions = splitLines(plan.exclusions);
  const terms = splitLines(plan.terms);

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.headerBand}>
          <View style={styles.headerRow}>
            {logoSrc ? (
              <PdfLogo src={logoSrc} square={square} />
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

        <View style={styles.docBadge}>
          <Text style={styles.docBadgeText}>HOLIDAY PACKAGE PROPOSAL</Text>
        </View>
        <Text style={styles.tripTitle}>{plan.title}</Text>
        <Text style={styles.tripSubtitle}>
          {[plan.destinations, nights != null ? `${nights} Night${nights !== 1 ? "s" : ""}` : null]
            .filter(Boolean)
            .join("  ·  ") || "Custom holiday itinerary"}
        </Text>

        <View style={styles.metaRow}>
          <View style={styles.metaCol}>
            <Text style={styles.metaLabel}>Proposal</Text>
            <Text style={styles.metaValue}>Version {plan.version}</Text>
          </View>
          <View style={styles.metaCol}>
            <Text style={styles.metaLabel}>Date</Text>
            <Text style={styles.metaValue}>{format(new Date(), "dd MMM yyyy")}</Text>
          </View>
          <View style={styles.metaCol}>
            <Text style={styles.metaLabel}>Query</Text>
            <Text style={styles.metaValue}>{lead.queryRef || "—"}</Text>
          </View>
          <View style={styles.metaCol}>
            <Text style={styles.metaLabel}>Status</Text>
            <Text style={styles.metaValue}>{plan.status.replace(/_/g, " ")}</Text>
          </View>
        </View>

        <View style={styles.summaryRow}>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Travel dates</Text>
            <Text style={styles.summaryValue}>
              {fmtDate(plan.travelDate)}
              {plan.returnDate ? `\n→ ${fmtDate(plan.returnDate)}` : ""}
            </Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Duration</Text>
            <Text style={styles.summaryValue}>
              {plan.durationDays
                ? `${plan.durationDays} Day${plan.durationDays !== 1 ? "s" : ""}`
                : "—"}
              {nights != null ? ` / ${nights}N` : ""}
            </Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Travellers</Text>
            <Text style={styles.summaryValue}>{paxLabel(plan)}</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Rooms</Text>
            <Text style={styles.summaryValue}>
              {plan.roomCount ? `${plan.roomCount}` : "—"}
            </Text>
          </View>
        </View>

        <View style={styles.guestCard}>
          <Text style={styles.guestTitle}>Prepared for</Text>
          <View style={styles.guestRow}>
            <Text style={styles.guestLabel}>Guest</Text>
            <Text style={styles.guestValue}>{lead.name}</Text>
          </View>
          {lead.phone ? (
            <View style={styles.guestRow}>
              <Text style={styles.guestLabel}>Phone</Text>
              <Text style={styles.guestValue}>{lead.phone}</Text>
            </View>
          ) : null}
          {lead.email ? (
            <View style={styles.guestRow}>
              <Text style={styles.guestLabel}>Email</Text>
              <Text style={styles.guestValue}>{lead.email}</Text>
            </View>
          ) : null}
          {plan.leavingFrom ? (
            <View style={styles.guestRow}>
              <Text style={styles.guestLabel}>Leaving from</Text>
              <Text style={styles.guestValue}>{plan.leavingFrom}</Text>
            </View>
          ) : null}
          {plan.nationality ? (
            <View style={styles.guestRow}>
              <Text style={styles.guestLabel}>Nationality</Text>
              <Text style={styles.guestValue}>{plan.nationality}</Text>
            </View>
          ) : null}
        </View>

        {days.length > 0 ? (
          <View>
            <Text style={styles.sectionTitle}>Day-wise itinerary</Text>
            {days.map(([day, dayItems]) => (
              <View key={day} style={styles.dayBlock} wrap={false}>
                <View style={styles.dayHeader}>
                  <View style={styles.dayPill}>
                    <Text style={styles.dayPillText}>Day {day}</Text>
                  </View>
                  <View style={styles.dayLine} />
                </View>
                {dayItems.map((item) => (
                  <View key={item.id} style={styles.itemBox}>
                    <View style={styles.itemTop}>
                      <Text style={styles.itemTitle}>{item.title}</Text>
                      <View style={styles.serviceChip}>
                        <Text style={styles.serviceChipText}>
                          {TRIP_SERVICE_TYPE_LABELS[item.serviceType]}
                        </Text>
                      </View>
                    </View>
                    {[item.location, item.supplierName].filter(Boolean).length > 0 ? (
                      <Text style={styles.itemMeta}>
                        {[item.location, item.supplierName].filter(Boolean).join(" · ")}
                      </Text>
                    ) : null}
                    {item.description ? (
                      <Text style={styles.itemDesc}>{item.description}</Text>
                    ) : null}
                  </View>
                ))}
              </View>
            ))}
          </View>
        ) : null}

        <Text style={styles.sectionTitle}>Price summary</Text>
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={[styles.th, styles.colService]}>Service</Text>
            <Text style={[styles.th, styles.colDesc]}>Description</Text>
            <Text style={[styles.th, styles.colQty]}>Qty</Text>
            <Text style={[styles.th, styles.colAmount]}>Rate</Text>
            <Text style={[styles.th, styles.colTotal]}>Amount</Text>
          </View>
          {items.length === 0 ? (
            <View style={styles.tableRow}>
              <Text style={[styles.td, { width: "100%" }]}>No priced line items yet.</Text>
            </View>
          ) : (
            items.map((item) => (
              <View key={item.id} style={styles.tableRow} wrap={false}>
                <Text style={[styles.td, styles.colService]}>
                  {TRIP_SERVICE_TYPE_LABELS[item.serviceType]}
                </Text>
                <Text style={[styles.td, styles.colDesc]}>{item.title}</Text>
                <Text style={[styles.td, styles.colQty]}>{item.quantity}</Text>
                <Text style={[styles.td, styles.colAmount]}>
                  {inr(Number(item.sellPrice) / Math.max(1, item.quantity))}
                </Text>
                <Text style={[styles.td, styles.colTotal]}>{inr(Number(item.sellPrice))}</Text>
              </View>
            ))
          )}
        </View>

        <View style={styles.totalBox}>
          {plan.gstAmount ? (
            <Text style={styles.totalGst}>
              GST ({Number(plan.gstRate)}%): {inr(Number(plan.gstAmount))}
            </Text>
          ) : null}
          <Text style={styles.offerPrice}>Offer price: {inr(Number(plan.offerPrice))}</Text>
          <Text style={styles.currencyNote}>All prices in {plan.currency}</Text>
        </View>

        {(inclusions.length > 0 || exclusions.length > 0) && (
          <View style={styles.twoCol}>
            {inclusions.length > 0 && (
              <View style={styles.halfCard}>
                <Text style={styles.halfTitle}>Inclusions</Text>
                {inclusions.map((line, i) => (
                  <Text key={`inc-${i}`} style={styles.bullet}>
                    • {line}
                  </Text>
                ))}
              </View>
            )}
            {exclusions.length > 0 && (
              <View style={styles.halfCard}>
                <Text style={styles.halfTitle}>Exclusions</Text>
                {exclusions.map((line, i) => (
                  <Text key={`exc-${i}`} style={styles.bullet}>
                    • {line}
                  </Text>
                ))}
              </View>
            )}
          </View>
        )}

        {terms.length > 0 ? (
          <View style={styles.termsBox} wrap={false}>
            <Text style={styles.termsTitle}>Terms & conditions</Text>
            {terms.map((line, i) => (
              <Text key={`term-${i}`} style={styles.bullet}>
                • {line}
              </Text>
            ))}
          </View>
        ) : null}

        <Text style={styles.footer}>
          This is a computer-generated holiday proposal from {agency.companyName}. Prices and
          availability are subject to confirmation at the time of booking.
          {agency.phone ? `  ·  ${agency.phone}` : ""}
        </Text>
      </Page>
    </Document>
  );
}
