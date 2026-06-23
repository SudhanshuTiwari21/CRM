import { renderToBuffer } from "@react-pdf/renderer";
import fs from "fs/promises";
import path from "path";
import { prisma } from "@/lib/db";
import { FlightTicketPDF } from "@/templates/pdf/flight-ticket";
import { HotelVoucherPDF } from "@/templates/pdf/hotel-voucher";
import { BusTicketPDF } from "@/templates/pdf/bus-ticket";
import { InvoicePDF } from "@/templates/pdf/invoice";
import type { DocumentType } from "@prisma/client";
import type { FlightPassenger, FlightSegment, HotelGuest, BusPassenger } from "@/types/booking";
import { logActivity } from "./activity.service";
import { getPdfLogoDataUri } from "@/lib/pdf-logo";
import { generateSegmentBarcodes } from "@/lib/flight-barcode";
import { getAirlineLogoDataUri } from "@/lib/airline-logo-pdf";
import { resolveAirlineIata } from "@/lib/airline-logo";

function getStorageDir() {
  // Vercel serverless only allows writes to /tmp
  if (process.env.VERCEL === "1") {
    return path.join("/tmp", "flight-crm-documents");
  }
  return path.join(process.cwd(), "storage", "documents");
}

async function ensureStorageDir() {
  await fs.mkdir(getStorageDir(), { recursive: true });
}

export async function generateBookingDocuments(bookingId: string, userId?: string) {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: {
      customer: true,
      flightBooking: true,
      hotelBooking: true,
      busBooking: true,
      payments: true,
    },
  });

  if (!booking) throw new Error("Booking not found");

  const agency = await prisma.agencySettings.findUnique({ where: { id: "default" } });
  if (!agency) throw new Error("Agency settings not found");

  const storageDir = getStorageDir();
  await ensureStorageDir();
  const logoSrc = await getPdfLogoDataUri();
  const documents: { type: DocumentType; fileName: string; storagePath: string }[] = [];

  if (booking.productType === "FLIGHT" && booking.flightBooking) {
    const segments = booking.flightBooking.segments as unknown as FlightSegment[];
    const passengers = booking.flightBooking.passengers as unknown as FlightPassenger[];
    const airlineLogoSrc = await getAirlineLogoDataUri(booking.flightBooking.airline);
    const barcodes = await generateSegmentBarcodes({
      pnr: booking.pnr || booking.publicRef,
      bookingRef: booking.publicRef,
      passengers,
      segments,
      airlineCode: resolveAirlineIata(booking.flightBooking.airline),
    });

    const ticketBuffer = await renderToBuffer(
      FlightTicketPDF({
        agency,
        booking,
        flight: booking.flightBooking,
        segments,
        passengers,
        airlineLogoSrc,
        barcodes,
      })
    );
    const ticketFileName = `${booking.publicRef}-ticket.pdf`;
    const ticketPath = path.join(storageDir, ticketFileName);
    await fs.writeFile(ticketPath, ticketBuffer);
    documents.push({ type: "TICKET", fileName: ticketFileName, storagePath: ticketPath });
  }

  if (booking.productType === "HOTEL" && booking.hotelBooking) {
    const voucherBuffer = await renderToBuffer(
      HotelVoucherPDF({
        agency,
        booking,
        hotel: booking.hotelBooking,
        guests: booking.hotelBooking.guests as unknown as HotelGuest[],
        logoSrc,
      })
    );
    const voucherFileName = `${booking.publicRef}-voucher.pdf`;
    const voucherPath = path.join(storageDir, voucherFileName);
    await fs.writeFile(voucherPath, voucherBuffer);
    documents.push({ type: "VOUCHER", fileName: voucherFileName, storagePath: voucherPath });
  }

  if (booking.productType === "BUS" && booking.busBooking) {
    const ticketBuffer = await renderToBuffer(
      BusTicketPDF({
        agency,
        booking,
        bus: booking.busBooking,
        passengers: booking.busBooking.passengers as unknown as BusPassenger[],
      })
    );
    const ticketFileName = `${booking.publicRef}-bus-ticket.pdf`;
    const ticketPath = path.join(storageDir, ticketFileName);
    await fs.writeFile(ticketPath, ticketBuffer);
    documents.push({ type: "TICKET", fileName: ticketFileName, storagePath: ticketPath });
  }

  const invoiceBuffer = await renderToBuffer(
    InvoicePDF({
      agency,
      booking,
      customer: booking.customer,
      payments: booking.payments,
      flight: booking.flightBooking,
      segments: booking.flightBooking
        ? (booking.flightBooking.segments as unknown as FlightSegment[])
        : undefined,
      passengers: booking.flightBooking
        ? (booking.flightBooking.passengers as unknown as FlightPassenger[])
        : undefined,
      logoSrc,
    })
  );
  const invoiceFileName = `${booking.publicRef}-invoice.pdf`;
  const invoicePath = path.join(storageDir, invoiceFileName);
  await fs.writeFile(invoicePath, invoiceBuffer);
  documents.push({ type: "INVOICE", fileName: invoiceFileName, storagePath: invoicePath });

  const existingDocs = await prisma.document.findMany({ where: { bookingId } });
  for (const doc of existingDocs) {
    try {
      await fs.unlink(doc.storagePath);
    } catch {
      // file may already be missing
    }
  }
  await prisma.document.deleteMany({ where: { bookingId } });

  for (const doc of documents) {
    await prisma.document.create({
      data: {
        bookingId,
        type: doc.type,
        fileName: doc.fileName,
        storagePath: doc.storagePath,
      },
    });
  }

  await logActivity({
    bookingId,
    userId,
    action: "DOCUMENTS_GENERATED",
    details: { files: documents.map((d) => d.fileName) },
  });

  return documents;
}

export async function getBookingDocumentPaths(bookingId: string) {
  const docs = await prisma.document.findMany({ where: { bookingId } });
  return docs.map((d) => d.storagePath);
}
