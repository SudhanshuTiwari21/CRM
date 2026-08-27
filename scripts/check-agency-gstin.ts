import { PrismaClient } from "@prisma/client";

const p = new PrismaClient();

async function main() {
  const rows = await p.agencySettings.findMany({
    select: {
      brandId: true,
      companyName: true,
      gstin: true,
      phone: true,
      email: true,
      address: true,
    },
  });
  console.log(JSON.stringify(rows, null, 2));
}

main()
  .finally(() => p.$disconnect());
