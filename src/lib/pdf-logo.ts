import fs from "fs/promises";
import path from "path";

let cachedLogoDataUri: string | null = null;

/** PNG data URI for @react-pdf/renderer - uses prebuilt asset (no sharp on serverless). */
export async function getPdfLogoDataUri(): Promise<string | null> {
  if (cachedLogoDataUri) return cachedLogoDataUri;

  const pngPath = path.join(process.cwd(), "public", "booktoroam-logo.png");
  try {
    const pngBuffer = await fs.readFile(pngPath);
    cachedLogoDataUri = `data:image/png;base64,${pngBuffer.toString("base64")}`;
    return cachedLogoDataUri;
  } catch {
    return null;
  }
}
