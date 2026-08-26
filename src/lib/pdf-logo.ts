import fs from "fs/promises";
import path from "path";
import { brandFromCompanyName, getBrandPreset } from "@/lib/branding";
import { getAgencySettings } from "@/lib/brand-context";

const logoCache = new Map<string, string | null>();

function publicFileCandidates(fileName: string) {
  return [
    path.join(process.cwd(), "public", fileName),
    path.join(process.cwd(), "public", fileName.replace(/^\/+/, "")),
  ];
}

async function readPngDataUri(fileName: string): Promise<string | null> {
  if (logoCache.has(fileName)) return logoCache.get(fileName) ?? null;

  for (const pngPath of publicFileCandidates(fileName)) {
    try {
      const pngBuffer = await fs.readFile(pngPath);
      const dataUri = `data:image/png;base64,${pngBuffer.toString("base64")}`;
      logoCache.set(fileName, dataUri);
      return dataUri;
    } catch {
      // try next path
    }
  }

  logoCache.set(fileName, null);
  return null;
}

/** PNG data URI for @react-pdf/renderer - uses prebuilt asset (no sharp on serverless). */
export async function getPdfLogoDataUri(companyName?: string | null): Promise<string | null> {
  let resolvedName = companyName;
  if (resolvedName === undefined) {
    try {
      const agency = await getAgencySettings();
      resolvedName = agency?.companyName;
    } catch {
      resolvedName = null;
    }
  }

  const brand = getBrandPreset(brandFromCompanyName(resolvedName));
  const files =
    brand.id === "techrecoil"
      ? [brand.pdfLogoFile, "image.png", "techrecoil-logo.png"]
      : [brand.pdfLogoFile];

  for (const fileName of files) {
    const uri = await readPngDataUri(fileName);
    if (uri) return uri;
  }

  if (brand.id !== "book-to-roam") {
    return readPngDataUri("booktoroam-logo.png");
  }

  return null;
}
