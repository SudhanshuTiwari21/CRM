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
import { getBookingCustomerContact } from "@/lib/cash-customer";
import { getPdfLogoDataUri } from "@/lib/pdf-logo";
import { resolveSegmentAirline } from "@/lib/airline-logo";
import { getAirlineLogoDataUri } from "@/lib/airline-logo-pdf";
import { brandFromCompanyName, type BrandId } from "@/lib/branding";
import { getAgencySettings } from "@/lib/brand-context";

function getStorageDir() {
  // Vercel serverless only allows writes to /tmp
  if (process.env.VERCEL === "1") {
    return path.join("/tmp", "flight-crm-documents");
  }
  return path.join(process.cwd(), "storage", "documents");
}

export { getStorageDir };

async function ensureStorageDir() {
  await fs.mkdir(getStorageDir(), { recursive: true });
}

/** Resolve a stored path to a readable file (handles moved cwd or /tmp vs local storage). */
export async function resolveDocumentPath(storagePath: string, fileName: string) {
  const candidates = [
    storagePath,
    path.join(getStorageDir(), fileName),
    path.isAbsolute(storagePath) ? null : path.join(process.cwd(), storagePath),
  ].filter((value): value is string => Boolean(value));

  for (const candidate of [...new Set(candidates)]) {
    try {
      await fs.access(candidate);
      return candidate;
    } catch {
      // try next candidate
    }
  }
  return null;
}

function brandedPdfName(publicRef: string, kind: string, brandId: BrandId) {
  return `${publicRef}-${kind}-${brandId}.pdf`;
}

function fileMatchesBrand(fileName: string, brandId: BrandId) {
  return fileName.endsWith(`-${brandId}.pdf`);
}

async function documentsAreStaleForCurrentBrand(
  docs: { fileName: string; generatedAt?: Date }[],
  generatedAt?: Date
) {
  const agency = await getAgencySettings();
  if (!agency) return false;
  const brandId = brandFromCompanyName(agency.companyName);
  if (docs.some((doc) => !fileMatchesBrand(doc.fileName, brandId))) return true;
  if (generatedAt && agency.updatedAt.getTime() > generatedAt.getTime() + 500) return true;
  return false;
}

export async function readDocumentBuffer(
  doc: { storagePath: string; fileName: string; bookingId: string; type: DocumentType; generatedAt?: Date },
  options?: { userId?: string }
) {
  const stale = await documentsAreStaleForCurrentBrand([doc], doc.generatedAt);
  if (!stale) {
    const existing = await resolveDocumentPath(doc.storagePath, doc.fileName);
    if (existing) return fs.readFile(existing);
  }

  await generateBookingDocuments(doc.bookingId, options?.userId);
  const refreshed = await prisma.document.findFirst({
    where: { bookingId: doc.bookingId, type: doc.type },
  });
  if (!refreshed) {
    throw new Error(`Document record not found for ${doc.fileName}`);
  }

  const resolved = await resolveDocumentPath(refreshed.storagePath, refreshed.fileName);
  if (!resolved) {
    throw new Error(`Document file not found: ${refreshed.fileName}`);
  }
  return fs.readFile(resolved);
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

  const agency = await getAgencySettings();
  if (!agency) throw new Error("Agency settings not found");

  const customerContact = getBookingCustomerContact(booking);
  const customerForDocs = { ...booking.customer, ...customerContact };

  const storageDir = getStorageDir();
  await ensureStorageDir();
  const brandId = brandFromCompanyName(agency.companyName);
  const logoSrc = await getPdfLogoDataUri(agency.companyName);
  const documents: { type: DocumentType; fileName: string; storagePath: string }[] = [];

  if (booking.productType === "FLIGHT" && booking.flightBooking) {
    const segments = booking.flightBooking.segments as unknown as FlightSegment[];
    const passengers = booking.flightBooking.passengers as unknown as FlightPassenger[];
    const airlineLogoSrc = await getAirlineLogoDataUri(booking.flightBooking.airline);
    const segmentAirlineLogoSrcs = await Promise.all(
      segments.map((seg) =>
        getAirlineLogoDataUri(resolveSegmentAirline(seg, booking.flightBooking!.airline))
      )
    );

    const ticketBuffer = await renderToBuffer(
      FlightTicketPDF({
        agency,
        booking,
        flight: booking.flightBooking,
        customer: customerForDocs,
        segments,
        passengers,
        logoSrc,
        airlineLogoSrc,
        segmentAirlineLogoSrcs,
      })
    );
    const ticketFileName = brandedPdfName(booking.publicRef, "ticket", brandId);
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
        customer: customerForDocs,
        guests: booking.hotelBooking.guests as unknown as HotelGuest[],
        logoSrc,
      })
    );
    const voucherFileName = brandedPdfName(booking.publicRef, "voucher", brandId);
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
        logoSrc,
      })
    );
    const ticketFileName = brandedPdfName(booking.publicRef, "bus-ticket", brandId);
    const ticketPath = path.join(storageDir, ticketFileName);
    await fs.writeFile(ticketPath, ticketBuffer);
    documents.push({ type: "TICKET", fileName: ticketFileName, storagePath: ticketPath });
  }

  const invoiceBuffer = await renderToBuffer(
    InvoicePDF({
      agency,
      booking,
      customer: customerForDocs,
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
  const invoiceFileName = brandedPdfName(booking.publicRef, "invoice", brandId);
  const invoicePath = path.join(storageDir, invoiceFileName);
  await fs.writeFile(invoicePath, invoiceBuffer);
  documents.push({ type: "INVOICE", fileName: invoiceFileName, storagePath: invoicePath });

  const existingDocs = await prisma.document.findMany({ where: { bookingId } });
  const generatedTypes = documents.map((doc) => doc.type);

  for (const doc of documents) {
    const existing = existingDocs.find((row) => row.type === doc.type);
    if (existing) {
      if (existing.storagePath !== doc.storagePath) {
        try {
          await fs.unlink(existing.storagePath);
        } catch {
          // previous file may already be missing
        }
      }
      await prisma.document.update({
        where: { id: existing.id },
        data: {
          fileName: doc.fileName,
          storagePath: doc.storagePath,
          generatedAt: new Date(),
        },
      });
    } else {
      await prisma.document.create({
        data: {
          bookingId,
          type: doc.type,
          fileName: doc.fileName,
          storagePath: doc.storagePath,
        },
      });
    }
  }

  for (const stale of existingDocs) {
    if (!generatedTypes.includes(stale.type)) {
      try {
        await fs.unlink(stale.storagePath);
      } catch {
        // file may already be missing
      }
      await prisma.document.delete({ where: { id: stale.id } });
    }
  }

  await logActivity({
    bookingId,
    userId,
    action: "DOCUMENTS_GENERATED",
    details: { files: documents.map((d) => d.fileName) },
  });

  return documents;
}

export async function getBookingDocumentPaths(bookingId: string, userId?: string) {
  let docs = await prisma.document.findMany({ where: { bookingId } });
  const oldestGenerated = docs.reduce<Date | undefined>((min, doc) => {
    if (!min || doc.generatedAt < min) return doc.generatedAt;
    return min;
  }, undefined);

  const hasMissingFiles = await Promise.all(
    docs.map(async (doc) => !(await resolveDocumentPath(doc.storagePath, doc.fileName)))
  );
  const brandStale = await documentsAreStaleForCurrentBrand(docs, oldestGenerated);

  if (docs.length === 0 || hasMissingFiles.some(Boolean) || brandStale) {
    await generateBookingDocuments(bookingId, userId);
    docs = await prisma.document.findMany({ where: { bookingId } });
  }

  const paths: string[] = [];
  for (const doc of docs) {
    const resolved = await resolveDocumentPath(doc.storagePath, doc.fileName);
    if (resolved) paths.push(resolved);
  }
  return paths;
}
