/**
 * Regenerate public/booktoroam-logo.png from SVG (trimmed, PDF-sized).
 * Run: npm run generate:pdf-logo
 */
const fs = require("fs");
const path = require("path");
const sharp = require("next/node_modules/sharp");

const root = path.join(__dirname, "..");
const svgPath = path.join(root, "public", "booktoroam-logo.svg");
const pngPath = path.join(root, "public", "booktoroam-logo.png");

sharp(fs.readFileSync(svgPath))
  .trim()
  .resize({ width: 520 })
  .png()
  .toFile(pngPath)
  .then(async () => {
    const meta = await sharp(pngPath).metadata();
    console.log(`Wrote ${pngPath} (${meta.width}x${meta.height})`);
  });
