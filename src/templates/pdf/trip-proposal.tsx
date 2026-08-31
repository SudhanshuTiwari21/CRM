import React from "react";
import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import type { AgencySettings, TripPlan, TripPlanItem, Lead } from "@prisma/client";
import { format } from "date-fns";
import { PdfLogo } from "@/templates/pdf/pdf-logo";
import { brandUsesSquareLogo } from "@/lib/branding";
import { TRIP_SERVICE_TYPE_LABELS } from "@/lib/constants/trip-plan";

const styles = StyleSheet.create({
  page: { padding: 32, fontSize: 9, fontFamily: "Helvetica", color: "#111" },
  header: { flexDirection: "row", justifyContent: "space-between", marginBottom: 16 },
  companyBlock: { maxWidth: "55%" },
  companyName: { fontSize: 13, fontWeight: "bold", marginBottom: 4 },
  companyLine: { fontSize: 8, marginBottom: 2, lineHeight: 1.35 },
  metaBlock: { textAlign: "right", maxWidth: "40%" },
  title: { fontSize: 16, fontWeight: "bold", marginBottom: 4, color: "#1e40af" },
  metaLine: { fontSize: 8, marginBottom: 2 },
  section: { marginBottom: 12 },
  sectionTitle: {
    fontSize: 10,
    fontWeight: "bold",
    backgroundColor: "#eff6ff",
    padding: 6,
    marginBottom: 6,
    borderLeft: "3px solid #2563eb",
  },
  row: { flexDirection: "row", marginBottom: 3 },
  label: { width: "28%", fontWeight: "bold", fontSize: 8 },
  value: { width: "72%", fontSize: 8 },
  dayHeader: {
    fontSize: 9,
    fontWeight: "bold",
    marginTop: 8,
    marginBottom: 4,
    color: "#1d4ed8",
  },
  itemBox: {
    border: "1px solid #e5e7eb",
    padding: 8,
    marginBottom: 6,
    borderRadius: 2,
  },
  itemTitle: { fontSize: 9, fontWeight: "bold", marginBottom: 2 },
  itemMeta: { fontSize: 7.5, color: "#555", marginBottom: 2 },
  itemDesc: { fontSize: 8, lineHeight: 1.35, color: "#333" },
  table: { border: "1px solid #ccc", marginTop: 6 },
  tableHeader: { flexDirection: "row", backgroundColor: "#f3f4f6", borderBottom: "1px solid #ccc" },
  tableRow: { flexDirection: "row", borderBottom: "1px solid #eee" },
  th: { padding: 5, fontWeight: "bold", fontSize: 7.5 },
  td: { padding: 5, fontSize: 7.5 },
  colService: { width: "22%" },
  colDesc: { width: "38%" },
  colQty: { width: "10%", textAlign: "right" },
  colAmount: { width: "15%", textAlign: "right" },
  colTotal: { width: "15%", textAlign: "right" },
  totalBox: {
    marginTop: 10,
    padding: 10,
    backgroundColor: "#f0fdf4",
    border: "1px solid #86efac",
    alignItems: "flex-end",
  },
  offerPrice: { fontSize: 14, fontWeight: "bold", color: "#166534" },
  bullet: { fontSize: 8, marginBottom: 3, lineHeight: 1.35 },
  footer: {
    position: "absolute",
    bottom: 24,
    left: 32,
    right: 32,
    fontSize: 7,
    color: "#666",
    textAlign: "center",
  },
});

function inr(n: number) {
  return `Rs. ${n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
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

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <View style={styles.companyBlock}>
            {logoSrc ? <PdfLogo src={logoSrc} square={square} /> : null}
            <Text style={styles.companyName}>{agency.companyName}</Text>
            {agency.address ? <Text style={styles.companyLine}>{agency.address}</Text> : null}
            {agency.phone ? <Text style={styles.companyLine}>Phone: {agency.phone}</Text> : null}
            {agency.email ? <Text style={styles.companyLine}>Email: {agency.email}</Text> : null}
          </View>
          <View style={styles.metaBlock}>
            <Text style={styles.title}>Trip Proposal</Text>
            <Text style={styles.metaLine}>Version: V{plan.version}</Text>
            <Text style={styles.metaLine}>Date: {format(new Date(), "dd MMM yyyy")}</Text>
            {lead.queryRef ? <Text style={styles.metaLine}>Query: {lead.queryRef}</Text> : null}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Guest & Trip Summary</Text>
          <View style={styles.row}>
            <Text style={styles.label}>Guest</Text>
            <Text style={styles.value}>{lead.name}</Text>
          </View>
          {lead.phone ? (
            <View style={styles.row}>
              <Text style={styles.label}>Phone</Text>
              <Text style={styles.value}>{lead.phone}</Text>
            </View>
          ) : null}
          <View style={styles.row}>
            <Text style={styles.label}>Trip</Text>
            <Text style={styles.value}>{plan.title}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Destinations</Text>
            <Text style={styles.value}>{plan.destinations || "—"}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Travel dates</Text>
            <Text style={styles.value}>
              {fmtDate(plan.travelDate)}
              {plan.returnDate ? ` → ${fmtDate(plan.returnDate)}` : ""}
              {plan.durationDays ? ` (${plan.durationDays} days)` : ""}
            </Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Travellers</Text>
            <Text style={styles.value}>{paxLabel(plan)}</Text>
          </View>
        </View>

        {days.length > 0 ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Day-wise Itinerary</Text>
            {days.map(([day, dayItems]) => (
              <View key={day}>
                <Text style={styles.dayHeader}>Day {day}</Text>
                {dayItems.map((item) => (
                  <View key={item.id} style={styles.itemBox}>
                    <Text style={styles.itemTitle}>
                      {TRIP_SERVICE_TYPE_LABELS[item.serviceType]} — {item.title}
                    </Text>
                    <Text style={styles.itemMeta}>
                      {[item.location, item.supplierName].filter(Boolean).join(" · ") || " "}
                    </Text>
                    {item.description ? <Text style={styles.itemDesc}>{item.description}</Text> : null}
                  </View>
                ))}
              </View>
            ))}
          </View>
        ) : null}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Price Summary</Text>
          <View style={styles.table}>
            <View style={styles.tableHeader}>
              <Text style={[styles.th, styles.colService]}>Service</Text>
              <Text style={[styles.th, styles.colDesc]}>Description</Text>
              <Text style={[styles.th, styles.colQty]}>Qty</Text>
              <Text style={[styles.th, styles.colAmount]}>Rate</Text>
              <Text style={[styles.th, styles.colTotal]}>Amount</Text>
            </View>
            {items.map((item) => (
              <View key={item.id} style={styles.tableRow}>
                <Text style={[styles.td, styles.colService]}>
                  {TRIP_SERVICE_TYPE_LABELS[item.serviceType]}
                </Text>
                <Text style={[styles.td, styles.colDesc]}>{item.title}</Text>
                <Text style={[styles.td, styles.colQty]}>{item.quantity}</Text>
                <Text style={[styles.td, styles.colAmount]}>
                  {inr(Number(item.sellPrice) / item.quantity)}
                </Text>
                <Text style={[styles.td, styles.colTotal]}>{inr(Number(item.sellPrice))}</Text>
              </View>
            ))}
          </View>
          <View style={styles.totalBox}>
            {plan.gstAmount ? (
              <Text style={styles.metaLine}>GST ({Number(plan.gstRate)}%): {inr(Number(plan.gstAmount))}</Text>
            ) : null}
            <Text style={styles.offerPrice}>Offer Price: {inr(Number(plan.offerPrice))}</Text>
            <Text style={styles.metaLine}>All prices in {plan.currency}</Text>
          </View>
        </View>

        {plan.inclusions ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Inclusions</Text>
            {plan.inclusions.split("\n").map((line, i) => (
              <Text key={i} style={styles.bullet}>
                • {line.replace(/^[-•]\s*/, "")}
              </Text>
            ))}
          </View>
        ) : null}

        {plan.exclusions ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Exclusions</Text>
            {plan.exclusions.split("\n").map((line, i) => (
              <Text key={i} style={styles.bullet}>
                • {line.replace(/^[-•]\s*/, "")}
              </Text>
            ))}
          </View>
        ) : null}

        {plan.terms ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Terms & Conditions</Text>
            {plan.terms.split("\n").map((line, i) => (
              <Text key={i} style={styles.bullet}>
                {line.startsWith("•") ? line : `• ${line}`}
              </Text>
            ))}
          </View>
        ) : null}

        <Text style={styles.footer}>
          This is a computer-generated proposal from {agency.companyName}. Prices subject to availability.
        </Text>
      </Page>
    </Document>
  );
}
