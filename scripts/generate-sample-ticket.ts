/**
 * Generate a sample IndiGo-style flight ticket PDF locally.
 * Run: npx tsx scripts/generate-sample-ticket.ts
 */
import React from "react";
import { renderToBuffer } from "@react-pdf/renderer";
import fs from "fs/promises";
import path from "path";
import { Decimal } from "@prisma/client/runtime/library";
import { FlightTicketPDF } from "../src/templates/pdf/flight-ticket";
import { generateSegmentBarcodes } from "../src/lib/flight-barcode";
import { getAirlineLogoDataUri } from "../src/lib/airline-logo-pdf";
import { resolveAirlineIata } from "../src/lib/airline-logo";
import type { FlightPassenger, FlightSegment } from "../src/types/booking";

const outDir = path.join(process.cwd(), "storage", "documents");

const segments: FlightSegment[] = [
  {
    flightNumber: "6E 212",
    airline: "IndiGo",
    fromAirport: "CCU",
    fromCity: "Kolkata",
    toAirport: "GAU",
    toCity: "Guwahati",
    departureAt: "2026-05-28T03:30:00.000Z",
    arrivalAt: "2026-05-28T04:45:00.000Z",
    aircraft: "A320",
    terminal: "Terminal 1",
    direction: "outbound",
  },
];

const passengers: FlightPassenger[] = [
  {
    title: "Mr",
    firstName: "Robert",
    lastName: "Handique",
    gender: "Male",
    paxType: "adult",
    seat: undefined,
    meal: "none",
  },
];

async function main() {
  await fs.mkdir(outDir, { recursive: true });

  const agency = {
    id: "default",
    companyName: "Book to Roam",
    address: "Sample Agency Address",
    city: "Kolkata",
    state: "West Bengal",
    pincode: "700001",
    phone: "9876543210",
    email: "agency@example.com",
    gstin: "19AAAAA0000A1Z5",
    pan: "AAAAA0000A",
    logoUrl: null,
    bankName: null,
    bankAccount: null,
    bankIfsc: null,
    termsAndConditions: null,
    invoiceFooter: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const booking = {
    id: "sample",
    publicRef: "FB-2026-SAMPLE-TKT",
    serialYear: 2026,
    serialNumber: 99,
    channel: "OFFLINE" as const,
    productType: "FLIGHT" as const,
    status: "TICKET_SENT" as const,
    paymentStatus: "PAID" as const,
    totalAmount: new Decimal(5500),
    currency: "INR",
    pnr: "UC6MWT",
    supplierRef: null,
    confirmedAt: new Date("2026-05-21T12:50:00.000Z"),
    internalNotes: null,
    metadata: null,
    customerId: "c1",
    assignedAgentId: null,
    lastEditedAt: null,
    lastEditedById: null,
    createdAt: new Date("2026-05-21T12:50:00.000Z"),
    updatedAt: new Date(),
  };

  const flight = {
    id: "f1",
    bookingId: booking.id,
    airline: "IndiGo",
    airlineLogoUrl: null,
    segments,
    passengers,
    tripType: "ONE_WAY" as const,
    cabinClass: "ECONOMY" as const,
    secondaryPnr: null,
    showEticket: true,
    showPassengerName: true,
    baseFare: new Decimal(5000),
    serviceCharge: new Decimal(500),
    discountAmount: null,
    invoiceTaxType: "NON_ITC" as const,
    buyerGstin: null,
    buyerState: null,
    buyerStateCode: null,
    placeOfSupply: null,
    invoiceNarration: null,
    msmeNumber: null,
    hsnSac: "998551",
    cgstRate: new Decimal(0),
    sgstRate: new Decimal(0),
    igstRate: new Decimal(0),
    cgstAmount: new Decimal(0),
    sgstAmount: new Decimal(0),
    igstAmount: new Decimal(0),
  };

  const airlineLogoSrc = await getAirlineLogoDataUri("IndiGo");
  const barcodes = await generateSegmentBarcodes({
    pnr: booking.pnr,
    bookingRef: booking.publicRef,
    passengers,
    segments,
    airlineCode: resolveAirlineIata("IndiGo"),
  });

  const buffer = await renderToBuffer(
    FlightTicketPDF({
      agency,
      booking,
      flight,
      segments,
      passengers,
      airlineLogoSrc,
      barcodes,
    })
  );

  const outPath = path.join(outDir, "sample-flight-ticket-indigo.pdf");
  await fs.writeFile(outPath, buffer);
  console.log("Sample ticket:", outPath);
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
