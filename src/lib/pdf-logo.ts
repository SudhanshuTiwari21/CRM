import fs from "fs/promises";
import path from "path";
import sharp from "sharp";

let cachedLogoDataUri: string | null = null;

/** Converts booktoroam-logo.svg to a PNG data URI for @react-pdf/renderer Image. */
export async function getPdfLogoDataUri(): Promise<string> {
  if (cachedLogoDataUri) return cachedLogoDataUri;

  const svgPath = path.join(process.cwd(), "public", "booktoroam-logo.svg");
  const svgBuffer = await fs.readFile(svgPath);

  const pngBuffer = await sharp(svgBuffer)
    .resize(500, 120, { fit: "inside", withoutEnlargement: true })
    .png()
    .toBuffer();

  cachedLogoDataUri = `data:image/png;base64,${pngBuffer.toString("base64")}`;
  return cachedLogoDataUri;
}
