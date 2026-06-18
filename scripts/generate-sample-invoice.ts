/**
 * Generate sample invoice PDFs locally for preview.
 * Run: npx tsx scripts/generate-sample-invoice.ts
 */
import React from "react";
import { renderToBuffer } from "@react-pdf/renderer";
import fs from "fs/promises";
import path from "path";
import { prisma } from "../src/lib/db";
import { InvoicePDF } from "../src/templates/pdf/invoice";
import { getPdfLogoDataUri } from "../src/lib/pdf-logo";
import type { FlightPassenger, FlightSegment } from "../src/types/booking";
import type { FlightBooking } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";

const outDir = path.join(process.cwd(), "storage", "documents");

const segments: FlightSegment[] = [
  {
    flightNumber: "6E 212",
    airline: "SpiceJet",
    fromAirport: "MAA",
    fromCity: "Chennai",
    toAirport: "CCU",
    toCity: "Kolkata",
    departureAt: "2026-04-13T06:30:00.000Z",
    arrivalAt: "2026-04-13T08:45:00.000Z",
    direction: "outbound",
  },
];

const passengers: FlightPassenger[] = [
  {
    title: "Mr",
    firstName: "Sharad",
    lastName: "Jain",
    gender: "Male",
    paxType: "adult",
    seat: "12A",
    meal: "veg",
    checkInBaggage: "15 KG",
    ticketNumber: "176-1234567890",
  },
];

async function renderSample(params: {
  fileName: string;
  invoiceTaxType: "ITC" | "NON_ITC";
  buyerGstin?: string;
  buyerState?: string;
  serviceCharge: number;
  cgst: number;
  sgst: number;
  igst: number;
  narration: string;
  msmeNumber?: string;
  discount?: number;
}) {
  const agency = await prisma.agencySettings.findUnique({ where: { id: "default" } });
  if (!agency) throw new Error("Agency settings not found");

  const customer = {
    id: "sample",
    type: "BUSINESS" as const,
    name: params.invoiceTaxType === "ITC" ? "Binod Textiles" : "Manisha Kejriwal",
    email: "customer@example.com",
    phone: "9876543210",
    pan: null,
    gstin: params.buyerGstin || null,
    address: "12 Park Street",
    city: params.invoiceTaxType === "ITC" ? "Kolkata" : "Patna",
    state: params.buyerState || "West Bengal",
    pincode: "700001",
    tags: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const baseFare = 10582;
  const totalTax = params.cgst + params.sgst + params.igst;
  const grandTotal = baseFare + params.serviceCharge + totalTax - (params.discount || 0);

  const booking = {
    id: "sample-booking",
    publicRef: "FB-2026-SAMPLE",
    channel: "OFFLINE" as const,
    productType: "FLIGHT" as const,
    status: "TICKET_SENT" as const,
    paymentStatus: "PAID" as const,
    totalAmount: new Decimal(grandTotal),
    currency: "INR",
    pnr: "F8HZQY",
    supplierRef: null,
    confirmedAt: new Date(),
    internalNotes: null,
    metadata: null,
    customerId: customer.id,
    assignedAgentId: null,
    createdAt: new Date("2026-04-12"),
    updatedAt: new Date(),
  };

  const flight = {
    id: "sample-flight",
    bookingId: booking.id,
    airline: "SpiceJet",
    airlineLogoUrl: null,
    segments,
    passengers,
    tripType: "ONE_WAY" as const,
    cabinClass: "ECONOMY" as const,
    secondaryPnr: null,
    showEticket: true,
    baseFare: new Decimal(baseFare),
    serviceCharge: new Decimal(params.serviceCharge),
    discountAmount: params.discount ? new Decimal(params.discount) : null,
    invoiceTaxType: params.invoiceTaxType,
    buyerGstin: params.buyerGstin || null,
    buyerState: params.buyerState || null,
    buyerStateCode: params.buyerGstin?.slice(0, 2) || "19",
    placeOfSupply: params.buyerState || "West Bengal",
    invoiceNarration: params.narration,
    msmeNumber: params.msmeNumber || null,
    hsnSac: "998551",
    cgstRate: params.cgst > 0 ? new Decimal(9) : new Decimal(0),
    sgstRate: params.sgst > 0 ? new Decimal(9) : new Decimal(0),
    igstRate: params.igst > 0 ? new Decimal(18) : new Decimal(0),
    cgstAmount: new Decimal(params.cgst),
    sgstAmount: new Decimal(params.sgst),
    igstAmount: new Decimal(params.igst),
  };

  const logoSrc = await getPdfLogoDataUri();
  const buffer = await renderToBuffer(
    InvoicePDF({
      agency,
      booking,
      customer,
      payments: [{ id: "p1", bookingId: booking.id, amount: new Decimal(grandTotal), method: "UPI", gatewayRef: null, status: "PAID", paidAt: new Date(), createdAt: new Date() }],
      flight: flight as unknown as FlightBooking,
      segments,
      passengers,
      logoSrc,
    })
  );

  const outPath = path.join(outDir, params.fileName);
  await fs.writeFile(outPath, buffer);
  return outPath;
}

async function main() {
  await fs.mkdir(outDir, { recursive: true });

  const b2bPath = await renderSample({
    fileName: "sample-invoice-b2b.pdf",
    invoiceTaxType: "ITC",
    buyerGstin: "19AAEFB7856M1ZT",
    buyerState: "West Bengal",
    serviceCharge: 438.98,
    cgst: 39.51,
    sgst: 39.51,
    igst: 0,
    narration: "Sector - MAA-CCU 11100/-",
    msmeNumber: agencyMsmeFromSettings(),
    discount: 0,
  });

  const b2cPath = await renderSample({
    fileName: "sample-invoice-b2c.pdf",
    invoiceTaxType: "NON_ITC",
    buyerState: "Bihar",
    serviceCharge: 438.98,
    cgst: 39.51,
    sgst: 39.51,
    igst: 0,
    narration: "Sector - MAA-CCU 11100/- (Retail customer)",
    discount: 100,
  });

  // interstate B2B sample
  const b2bIgstPath = await renderSample({
    fileName: "sample-invoice-b2b-igst.pdf",
    invoiceTaxType: "ITC",
    buyerGstin: "07AAACB2894G1ZN",
    buyerState: "Delhi",
    serviceCharge: 438.98,
    cgst: 0,
    sgst: 0,
    igst: 79.02,
    narration: "Inter-state B2B — IGST applicable",
  });

  console.log("B2B sample:", b2bPath);
  console.log("B2C sample:", b2cPath);
  console.log("B2B IGST sample:", b2bIgstPath);
}

function agencyMsmeFromSettings(): string | undefined {
  return undefined;
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
