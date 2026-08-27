import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/** Copy shared agency details from Book to Roam onto TechRecoil if TR is missing them. */
async function main() {
  const btr = await prisma.agencySettings.findUnique({ where: { brandId: "BOOK_TO_ROAM" } });
  const tr = await prisma.agencySettings.findUnique({ where: { brandId: "TECHRECOIL" } });

  if (!btr) {
    console.error("Book to Roam agency settings not found");
    process.exit(1);
  }

  if (!tr) {
    console.error("TechRecoil agency settings not found");
    process.exit(1);
  }

  const updated = await prisma.agencySettings.update({
    where: { brandId: "TECHRECOIL" },
    data: {
      // Keep TechRecoil branding, fill missing legal/contact from BTR if empty
      gstin: tr.gstin?.trim() || btr.gstin,
      pan: tr.pan?.trim() || btr.pan,
      tan: tr.tan?.trim() || btr.tan,
      address: tr.address?.trim() || btr.address,
      city: tr.city?.trim() || btr.city,
      state: tr.state?.trim() || btr.state,
      pincode: tr.pincode?.trim() || btr.pincode,
      phone: tr.phone?.trim() || btr.phone,
      bankName: tr.bankName?.trim() || btr.bankName,
      bankAccount: tr.bankAccount?.trim() || btr.bankAccount,
      bankIfsc: tr.bankIfsc?.trim() || btr.bankIfsc,
      bankBranch: tr.bankBranch?.trim() || btr.bankBranch,
      msmeRegistered: tr.msmeRegistered || btr.msmeRegistered,
      msmeNumber: tr.msmeNumber?.trim() || btr.msmeNumber,
    },
  });

  console.log("TechRecoil settings after fix:", {
    companyName: updated.companyName,
    gstin: updated.gstin,
    phone: updated.phone,
    address: updated.address,
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
