/**
 * Regenerate ticket/invoice PDFs for all bookings in the database.
 * Run: npx tsx scripts/regenerate-all-documents.ts
 */
import { prisma } from "../src/lib/db";
import { generateBookingDocuments } from "../src/lib/services/document.service";

async function main() {
  const bookings = await prisma.booking.findMany({
    where: { status: { not: "CANCELLED" } },
    select: { id: true, publicRef: true, productType: true },
    orderBy: { createdAt: "asc" },
  });

  if (bookings.length === 0) {
    console.log("No bookings found.");
    return;
  }

  console.log(`Regenerating documents for ${bookings.length} booking(s)...\n`);

  let ok = 0;
  let failed = 0;

  for (const b of bookings) {
    try {
      const docs = await generateBookingDocuments(b.id);
      console.log(`✓ ${b.publicRef} (${b.productType}) → ${docs.map((d) => d.fileName).join(", ")}`);
      ok++;
    } catch (error) {
      failed++;
      const msg = error instanceof Error ? error.message : String(error);
      console.error(`✗ ${b.publicRef}: ${msg}`);
    }
  }

  console.log(`\nDone: ${ok} succeeded, ${failed} failed.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
