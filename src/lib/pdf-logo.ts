import fs from "fs/promises";
import path from "path";
import { prisma } from "@/lib/db";
import { brandFromCompanyName, getBrandPreset } from "@/lib/branding";

const logoCache = new Map<string, string | null>();

/** PNG data URI for @react-pdf/renderer - uses prebuilt asset (no sharp on serverless). */
export async function getPdfLogoDataUri(): Promise<string | null> {
  let fileName = "booktoroam-logo.png";
  try {
    const agency = await prisma.agencySettings.findUnique({
      where: { id: "default" },
      select: { companyName: true },
    });
    const brand = getBrandPreset(brandFromCompanyName(agency?.companyName));
    fileName = brand.pdfLogoFile;
  } catch {
    // Fall back to Book to Roam logo.
  }

  if (logoCache.has(fileName)) return logoCache.get(fileName) ?? null;

  const pngPath = path.join(process.cwd(), "public", fileName);
  try {
    const pngBuffer = await fs.readFile(pngPath);
    const dataUri = `data:image/png;base64,${pngBuffer.toString("base64")}`;
    logoCache.set(fileName, dataUri);
    return dataUri;
  } catch {
    // TechRecoil PNG may be missing — try Book to Roam, then null.
    if (fileName !== "booktoroam-logo.png") {
      try {
        const fallback = path.join(process.cwd(), "public", "booktoroam-logo.png");
        const pngBuffer = await fs.readFile(fallback);
        const dataUri = `data:image/png;base64,${pngBuffer.toString("base64")}`;
        logoCache.set(fileName, dataUri);
        return dataUri;
      } catch {
        logoCache.set(fileName, null);
        return null;
      }
    }
    logoCache.set(fileName, null);
    return null;
  }
}
