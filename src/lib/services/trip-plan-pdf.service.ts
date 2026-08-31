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

export async function generateTripPlanPdf(tripPlanId: string) {
  const plan = await getTripPlanById(tripPlanId);
  const agency = await getAgencySettings();
  if (!agency) throw new Error("Agency settings not found");

  const logoSrc = await getPdfLogoDataUri(agency.companyName);
  const buffer = await renderToBuffer(
    TripProposalPDF({
      agency,
      plan,
      lead: plan.lead,
      items: plan.items,
      logoSrc,
    })
  );

  const storageDir = getStorageDir();
  await fs.mkdir(storageDir, { recursive: true });
  const fileName = `trip-proposal-${plan.lead.queryRef || plan.leadId}-v${plan.version}.pdf`;
  const storagePath = path.join(storageDir, fileName);
  await fs.writeFile(storagePath, buffer);

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
