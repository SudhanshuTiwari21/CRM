/**
 * Generate a sample Wingie-style flight voucher PDF (2 pages).
 * Run: npx tsx scripts/generate-sample-ticket.ts
 */
import React from "react";
import { renderToBuffer } from "@react-pdf/renderer";
import fs from "fs/promises";
import path from "path";
import { Decimal } from "@prisma/client/runtime/library";
import { FlightTicketPDF } from "../src/templates/pdf/flight-ticket";
import { getAirlineLogoDataUri } from "../src/lib/airline-logo-pdf";
import { getPdfLogoDataUri } from "../src/lib/pdf-logo";
import type { FlightPassenger, FlightSegment } from "../src/types/booking";

const outDir = path.join(process.cwd(), "storage", "documents");

const segments: FlightSegment[] = [
  {
    flightNumber: "AI1996",
    airline: "Air India",
    fromAirport: "DXB",
    fromCity: "Dubai",
    toAirport: "DEL",
    toCity: "Delhi",
    departureAt: "2026-08-28T18:45:00.000Z",
    arrivalAt: "2026-08-28T23:25:00.000Z",
    departureTerminal: "Terminal 1",
    terminal: "Terminal 3",
    layoverDuration: "3h 5min",
  },
  {
    flightNumber: "AI1749",
    airline: "Air India",
    fromAirport: "DEL",
    fromCity: "Delhi",
    toAirport: "PAT",
    toCity: "Patna",
    departureAt: "2026-08-29T02:30:00.000Z",
    arrivalAt: "2026-08-29T04:10:00.000Z",
    departureTerminal: "Terminal 2",
  },
];

const passengers: FlightPassenger[] = [
  {
    title: "Mr",
    firstName: "Shamshad",
    lastName: "Ali",
    gender: "Male",
    paxType: "adult",
    ticketNumber: "0984872349846",
    handBaggage: "1 piece X 7 kg cabin baggage",
    checkInBaggage: "1 piece X 25 kg checked baggage",
  },
];

async function main() {
  await fs.mkdir(outDir, { recursive: true });

  const agency = {
    id: "default",
    companyName: "Book to Roam",
    address: "12 Park Street",
    city: "Kolkata",
    state: "West Bengal",
    pincode: "700001",
    phone: "+91 9876543210",
    email: "info@booktoroam.com",
    gstin: "19AAAAA0000A1Z5",
    pan: "AAAAA0000A",
    tan: null,
    logoUrl: null,
    invoicePrefix: "INV",
    bankName: null,
    bankAccount: null,
    bankIfsc: null,
    bankBranch: null,
    msmeRegistered: false,
    msmeNumber: null,
    webhookApiKey: null,
    holdModeEnabled: false,
    smtpHost: null,
    smtpPort: null,
    smtpUser: null,
    smtpFrom: null,
    whatsappEnabled: false,
    whatsappPhoneNumberId: null,
    whatsappApiVersion: "v21.0",
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
    totalAmount: new Decimal(15227.84),
    currency: "INR",
    pnr: "9MFIS5",
    supplierRef: null,
    confirmedAt: new Date(),
    internalNotes: null,
    metadata: null,
    customerId: "c1",
    assignedAgentId: null,
    lastEditedAt: null,
    lastEditedById: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const flight = {
    id: "f1",
    bookingId: booking.id,
    airline: "Air India",
    airlineLogoUrl: null,
    segments,
    passengers,
    tripType: "ONE_WAY" as const,
    cabinClass: "ECONOMY" as const,
    secondaryPnr: null,
    showEticket: true,
    showPassengerName: true,
    checkInAssistance: false,
    checkInAssistanceNotifiedAt: null,
    earliestDepartureAt: new Date(segments[0].departureAt),
    baseFare: new Decimal(7887.2),
    serviceCharge: new Decimal(0),
    discountAmount: new Decimal(1443.73),
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
    igstRate: new Decimal(18),
    cgstAmount: new Decimal(0),
    sgstAmount: new Decimal(0),
    igstAmount: new Decimal(8784.37),
  };

  const [logoSrc, airlineLogoSrc] = await Promise.all([
    getPdfLogoDataUri(),
    getAirlineLogoDataUri("Air India"),
  ]);

  const buffer = await renderToBuffer(
    FlightTicketPDF({
      agency,
      booking,
      flight,
      segments,
      passengers,
      logoSrc,
      airlineLogoSrc,
    })
  );

  const outPath = path.join(outDir, "sample-flight-voucher-wingie.pdf");
  await fs.writeFile(outPath, buffer);
  console.log("Sample voucher:", outPath);
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
