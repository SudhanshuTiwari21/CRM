import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  buildAccountingCsv,
  buildTallyXml,
  getAccountingBills,
} from "@/lib/services/accounting.service";
import { handleApiError, jsonError } from "@/lib/api-utils";
import { getAgencySettings } from "@/lib/brand-context";

export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) return jsonError("Unauthorized", 401);

    const { searchParams } = new URL(request.url);
    const format = searchParams.get("format") || "xml";
    const type = (searchParams.get("type") || "ALL") as "ALL" | "ITC" | "NON_ITC";
    const msmeNumber = searchParams.get("msme") || undefined;
    const fromStr = searchParams.get("from");
    const toStr = searchParams.get("to");

    const from = fromStr ? new Date(fromStr) : undefined;
    const to = toStr ? new Date(`${toStr}T23:59:59.999Z`) : undefined;

    const agency = await getAgencySettings();
    const { rows } = await getAccountingBills({ type, msmeNumber, from, to });

    const companyName = agency?.companyName || "Book to Roam";
    const invoicePrefix = agency?.invoicePrefix || "INV";
    const stamp = new Date().toISOString().slice(0, 10);

    if (format === "csv") {
      const csv = buildAccountingCsv(rows, invoicePrefix);
      return new NextResponse(csv, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="accounting-${type.toLowerCase()}-${stamp}.csv"`,
        },
      });
    }

    const xml = buildTallyXml(rows, companyName, invoicePrefix);
    return new NextResponse(xml, {
      headers: {
        "Content-Type": "application/xml; charset=utf-8",
        "Content-Disposition": `attachment; filename="tally-sales-${type.toLowerCase()}-${stamp}.xml"`,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
