import { renderToBuffer } from "@react-pdf/renderer";
import fs from "fs/promises";
import path from "path";
import { getAgencySettings } from "@/lib/brand-context";
import { getPdfLogoDataUri } from "@/lib/pdf-logo";
import { getTripPlanById } from "@/lib/services/trip-plan.service";
import { TripProposalPDF } from "@/templates/pdf/trip-proposal";
import { prisma } from "@/lib/db";

function getStorageDir() {
  if (process.env.VERCEL === "1") {
    return path.join("/tmp", "flight-crm-trip-proposals");
  }
  return path.join(process.cwd(), "storage", "trip-proposals");
}

/** Keep PDF names filesystem-safe (query refs like Q/26/1 must not create nested dirs). */
export function tripPlanPdfFileName(queryRef: string | null | undefined, leadId: string, version: number) {
  const raw = (queryRef || leadId || "trip").trim();
  const safe = raw
    .replace(/[\\/]+/g, "-")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
  return `trip-proposal-${safe || "trip"}-v${version}.pdf`;
}

export async function generateTripPlanPdf(tripPlanId: string) {
  const plan = await getTripPlanById(tripPlanId);
  const agency = await getAgencySettings();
  if (!agency) throw new Error("Agency settings not found");

  const logoSrc = await getPdfLogoDataUri(agency.companyName);
  const buffer = Buffer.from(
    await renderToBuffer(
      TripProposalPDF({
        agency,
        plan,
        lead: plan.lead,
        items: plan.items,
        logoSrc,
      })
    )
  );

  const fileName = tripPlanPdfFileName(plan.lead.queryRef, plan.leadId, plan.version);

  // On Vercel /tmp is ephemeral and PDF is regenerated on each download — skip disk write.
  let storagePath: string | null = null;
  if (process.env.VERCEL !== "1") {
    const storageDir = getStorageDir();
    await fs.mkdir(storageDir, { recursive: true });
    storagePath = path.join(storageDir, fileName);
    await fs.writeFile(storagePath, buffer);
  }

  await prisma.tripPlan.update({
    where: { id: tripPlanId },
    data: { pdfGeneratedAt: new Date() },
  });

  return { buffer, fileName, storagePath };
}

export async function readTripPlanPdf(tripPlanId: string) {
  const { buffer } = await generateTripPlanPdf(tripPlanId);
  return buffer;
}
