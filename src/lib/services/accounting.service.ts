import { prisma } from "@/lib/db";
import type { InvoiceTaxType } from "@prisma/client";
import { format } from "date-fns";
import type { FlightSegment } from "@/types/booking";
import { getActiveDbBrand } from "@/lib/brand-context";

export interface AccountingBillRow {
  id: string;
  publicRef: string;
  pnr: string | null;
  date: string;
  customerName: string;
  customerGstin: string | null;
  buyerGstin: string | null;
  invoiceTaxType: InvoiceTaxType;
  msmeNumber: string | null;
  segment: string;
  baseFare: number;
  serviceCharge: number;
  cgst: number;
  sgst: number;
  igst: number;
  totalTax: number;
  totalAmount: number;
  hsnSac: string;
  placeOfSupply: string | null;
  paymentStatus: string;
}

export interface AccountingSummary {
  count: number;
  baseFare: number;
  serviceCharge: number;
  cgst: number;
  sgst: number;
  igst: number;
  totalTax: number;
  totalAmount: number;
}

function num(v: unknown) {
  return Number(v || 0);
}

function sectorFromSegments(segments: unknown) {
  const list = segments as FlightSegment[];
  const seg = list?.[0];
  if (!seg) return "-";
  return `${seg.fromAirport}-${seg.toAirport}`;
}

export async function getAccountingBills(params: {
  type?: "ALL" | "ITC" | "NON_ITC";
  msmeNumber?: string;
  from?: Date;
  to?: Date;
}) {
  const brandId = await getActiveDbBrand();
  const where = {
    brandId,
    productType: "FLIGHT" as const,
    flightBooking: {
      is: {
        baseFare: { not: null },
        ...(params.type && params.type !== "ALL"
          ? { invoiceTaxType: params.type as InvoiceTaxType }
          : {}),
        ...(params.msmeNumber ? { msmeNumber: params.msmeNumber } : {}),
      },
    },
    ...(params.from || params.to
      ? {
          createdAt: {
            ...(params.from ? { gte: params.from } : {}),
            ...(params.to ? { lte: params.to } : {}),
          },
        }
      : {}),
  };

  const bookings = await prisma.booking.findMany({
    where,
    include: {
      customer: true,
      flightBooking: true,
    },
    orderBy: { createdAt: "desc" },
  });

  const rows: AccountingBillRow[] = bookings
    .filter((b) => b.flightBooking?.baseFare != null)
    .map((b) => {
      const f = b.flightBooking!;
      const cgst = num(f.cgstAmount);
      const sgst = num(f.sgstAmount);
      const igst = num(f.igstAmount);
      return {
        id: b.id,
        publicRef: b.publicRef,
        pnr: b.pnr,
        date: b.createdAt.toISOString(),
        customerName: b.customer.name,
        customerGstin: b.customer.gstin,
        buyerGstin: f.buyerGstin,
        invoiceTaxType: f.invoiceTaxType,
        msmeNumber: f.msmeNumber,
        segment: sectorFromSegments(f.segments),
        baseFare: num(f.baseFare),
        serviceCharge: num(f.serviceCharge),
        cgst,
        sgst,
        igst,
        totalTax: cgst + sgst + igst,
        totalAmount: num(b.totalAmount),
        hsnSac: f.hsnSac || "998551",
        placeOfSupply: f.placeOfSupply,
        paymentStatus: b.paymentStatus,
      };
    });

  const summary = rows.reduce<AccountingSummary>(
    (acc, r) => ({
      count: acc.count + 1,
      baseFare: acc.baseFare + r.baseFare,
      serviceCharge: acc.serviceCharge + r.serviceCharge,
      cgst: acc.cgst + r.cgst,
      sgst: acc.sgst + r.sgst,
      igst: acc.igst + r.igst,
      totalTax: acc.totalTax + r.totalTax,
      totalAmount: acc.totalAmount + r.totalAmount,
    }),
    { count: 0, baseFare: 0, serviceCharge: 0, cgst: 0, sgst: 0, igst: 0, totalTax: 0, totalAmount: 0 }
  );

  const countBookings = await prisma.booking.findMany({
    where: {
      brandId,
      productType: "FLIGHT",
      flightBooking: { is: { baseFare: { not: null } } },
      ...(params.from || params.to
        ? {
            createdAt: {
              ...(params.from ? { gte: params.from } : {}),
              ...(params.to ? { lte: params.to } : {}),
            },
          }
        : {}),
    },
    select: { flightBooking: { select: { invoiceTaxType: true } } },
  });

  const b2bCount = countBookings.filter((b) => b.flightBooking?.invoiceTaxType === "ITC").length;
  const b2cCount = countBookings.filter((b) => b.flightBooking?.invoiceTaxType === "NON_ITC").length;

  return { rows, summary, b2bCount, b2cCount };
}

function tallyDate(iso: string) {
  return format(new Date(iso), "yyyyMMdd");
}

function escapeXml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function tallyAmount(n: number, deemedPositive: boolean) {
  const val = n.toFixed(2);
  return deemedPositive ? `-${val}` : val;
}

export function buildTallyXml(
  rows: AccountingBillRow[],
  companyName: string,
  invoicePrefix: string
) {
  const vouchers = rows
    .map((r) => {
      const vchNo = `${invoicePrefix}-${r.publicRef}`;
      const party = escapeXml(r.customerName);
      const narration = escapeXml(
        `Flight ${r.segment} PNR ${r.pnr || "-"} Ref ${r.publicRef} (${r.invoiceTaxType === "ITC" ? "B2B ITC" : "B2C"})`
      );
      const gstin = r.buyerGstin || r.customerGstin || "";

      const entries: string[] = [];

      entries.push(`<LEDGERENTRIES.LIST>
        <LEDGERNAME>${party}</LEDGERNAME>
        <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
        <ISPARTYLEDGER>Yes</ISPARTYLEDGER>
        <AMOUNT>${tallyAmount(r.totalAmount, true)}</AMOUNT>
        ${gstin ? `<PARTYGSTIN>${escapeXml(gstin)}</PARTYGSTIN>` : ""}
      </LEDGERENTRIES.LIST>`);

      if (r.baseFare > 0) {
        entries.push(`<LEDGERENTRIES.LIST>
          <LEDGERNAME>Fare Reimbursement</LEDGERNAME>
          <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
          <AMOUNT>${r.baseFare.toFixed(2)}</AMOUNT>
        </LEDGERENTRIES.LIST>`);
      }

      if (r.serviceCharge > 0) {
        entries.push(`<LEDGERENTRIES.LIST>
          <LEDGERNAME>Service Charges - Air Tickets</LEDGERNAME>
          <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
          <AMOUNT>${r.serviceCharge.toFixed(2)}</AMOUNT>
        </LEDGERENTRIES.LIST>`);
      }

      if (r.cgst > 0) {
        entries.push(`<LEDGERENTRIES.LIST>
          <LEDGERNAME>Output CGST</LEDGERNAME>
          <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
          <AMOUNT>${r.cgst.toFixed(2)}</AMOUNT>
        </LEDGERENTRIES.LIST>`);
      }
      if (r.sgst > 0) {
        entries.push(`<LEDGERENTRIES.LIST>
          <LEDGERNAME>Output SGST</LEDGERNAME>
          <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
          <AMOUNT>${r.sgst.toFixed(2)}</AMOUNT>
        </LEDGERENTRIES.LIST>`);
      }
      if (r.igst > 0) {
        entries.push(`<LEDGERENTRIES.LIST>
          <LEDGERNAME>Output IGST</LEDGERNAME>
          <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
          <AMOUNT>${r.igst.toFixed(2)}</AMOUNT>
        </LEDGERENTRIES.LIST>`);
      }

      return `<TALLYMESSAGE xmlns:UDF="TallyUDF">
        <VOUCHER VCHTYPE="Sales" ACTION="Create">
          <DATE>${tallyDate(r.date)}</DATE>
          <VOUCHERTYPENAME>Sales</VOUCHERTYPENAME>
          <VOUCHERNUMBER>${escapeXml(vchNo)}</VOUCHERNUMBER>
          <PARTYLEDGERNAME>${party}</PARTYLEDGERNAME>
          <REFERENCE>${escapeXml(r.publicRef)}</REFERENCE>
          <NARRATION>${narration}</NARRATION>
          <ALLLEDGERENTRIES.LIST>
            ${entries.join("\n")}
          </ALLLEDGERENTRIES.LIST>
        </VOUCHER>
      </TALLYMESSAGE>`;
    })
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<ENVELOPE>
  <HEADER>
    <TALLYREQUEST>Import Data</TALLYREQUEST>
  </HEADER>
  <BODY>
    <IMPORTDATA>
      <REQUESTDESC>
        <REPORTNAME>Vouchers</REPORTNAME>
        <STATICVARIABLES>
          <SVCURRENTCOMPANY>${escapeXml(companyName)}</SVCURRENTCOMPANY>
        </STATICVARIABLES>
      </REQUESTDESC>
      <REQUESTDATA>
        ${vouchers}
      </REQUESTDATA>
    </IMPORTDATA>
  </BODY>
</ENVELOPE>`;
}

export function buildAccountingCsv(rows: AccountingBillRow[], invoicePrefix: string) {
  const header = [
    "Date",
    "Voucher No",
    "Booking Ref",
    "PNR",
    "Customer",
    "GSTIN",
    "Type",
    "Sector",
    "HSN/SAC",
    "Place of Supply",
    "Base Fare",
    "Service Charge",
    "CGST",
    "SGST",
    "IGST",
    "Total Tax",
    "Invoice Total",
    "Payment Status",
  ].join(",");

  const lines = rows.map((r) =>
    [
      format(new Date(r.date), "dd-MM-yyyy"),
      `${invoicePrefix}-${r.publicRef}`,
      r.publicRef,
      r.pnr || "",
      `"${r.customerName.replace(/"/g, '""')}"`,
      r.buyerGstin || r.customerGstin || "",
      r.invoiceTaxType === "ITC" ? "B2B ITC" : "B2C Non-ITC",
      r.segment,
      r.hsnSac,
      r.placeOfSupply || "",
      r.baseFare.toFixed(2),
      r.serviceCharge.toFixed(2),
      r.cgst.toFixed(2),
      r.sgst.toFixed(2),
      r.igst.toFixed(2),
      r.totalTax.toFixed(2),
      r.totalAmount.toFixed(2),
      r.paymentStatus,
    ].join(",")
  );

  return [header, ...lines].join("\n");
}
