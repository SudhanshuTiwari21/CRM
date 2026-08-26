/**
 * Ensures both brands have agency settings + a TechRecoil admin user.
 * Existing operational data stays on BOOK_TO_ROAM.
 */
import { PrismaClient, UserRole } from "@prisma/client";
import { hash } from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const smtpUser = process.env.SMTP_USER || "";

  const btr = await prisma.agencySettings.findFirst({
    where: { OR: [{ brandId: "BOOK_TO_ROAM" }, { id: "default" }] },
  });

  if (btr) {
    await prisma.agencySettings.update({
      where: { id: btr.id },
      data: {
        brandId: "BOOK_TO_ROAM",
        companyName: btr.companyName?.includes("TechRecoil") ? "Book to Roam" : btr.companyName || "Book to Roam",
        logoUrl: "/booktoroam-logo.svg",
      },
    });
  } else {
    await prisma.agencySettings.create({
      data: {
        brandId: "BOOK_TO_ROAM",
        companyName: "Book to Roam",
        logoUrl: "/booktoroam-logo.svg",
        address: "136 Bangur Avenue Block C",
        city: "Kolkata",
        state: "West Bengal",
        pincode: "700055",
        phone: "9874133113",
        email: "hello@booktoroam.com",
        invoicePrefix: "INV",
        webhookApiKey: process.env.WEBHOOK_API_KEY || "dev-webhook-key-change-me",
        smtpHost: process.env.SMTP_HOST || "smtp.gmail.com",
        smtpPort: parseInt(process.env.SMTP_PORT || "587", 10),
        smtpUser: smtpUser || undefined,
      },
    });
  }

  await prisma.agencySettings.upsert({
    where: { brandId: "TECHRECOIL" },
    update: {
      companyName: "TechRecoil",
      logoUrl: "/techrecoil-logo.png",
    },
    create: {
      brandId: "TECHRECOIL",
      companyName: "TechRecoil",
      logoUrl: "/techrecoil-logo.png",
      email: "Sales@techrecoil.in",
      invoicePrefix: "TR",
      webhookApiKey: process.env.WEBHOOK_API_KEY || "dev-webhook-key-change-me",
      smtpHost: process.env.SMTP_HOST || "smtp.gmail.com",
      smtpPort: parseInt(process.env.SMTP_PORT || "587", 10),
      smtpUser: smtpUser || undefined,
      smtpFrom: smtpUser ? `TechRecoil <${smtpUser}>` : undefined,
    },
  });

  // Existing users → Book to Roam
  await prisma.user.updateMany({
    data: { brandId: "BOOK_TO_ROAM" },
  });

  // TechRecoil admin (separate login for that brand)
  const password = await hash("admin123", 12);
  const existingTr = await prisma.user.findFirst({
    where: { brandId: "TECHRECOIL", email: "admin@techrecoil.in" },
  });
  if (!existingTr) {
    // If email already exists on BTR, create a distinct TR email
    const btrSameEmail = await prisma.user.findFirst({
      where: { brandId: "BOOK_TO_ROAM", email: "admin@techrecoil.in" },
    });
    await prisma.user.create({
      data: {
        brandId: "TECHRECOIL",
        name: "TechRecoil Admin",
        email: btrSameEmail ? "admin.tr@techrecoil.in" : "admin@techrecoil.in",
        passwordHash: password,
        role: UserRole.ADMIN,
      },
    });
  }

  // Stamp brand on existing business data (all current data → BTR)
  await Promise.all([
    prisma.customer.updateMany({ data: { brandId: "BOOK_TO_ROAM" } }),
    prisma.booking.updateMany({ data: { brandId: "BOOK_TO_ROAM" } }),
    prisma.lead.updateMany({ data: { brandId: "BOOK_TO_ROAM" } }),
    prisma.payment.updateMany({ data: { brandId: "BOOK_TO_ROAM" } }),
    prisma.creditNote.updateMany({ data: { brandId: "BOOK_TO_ROAM" } }),
    prisma.emailTemplate.updateMany({ data: { brandId: "BOOK_TO_ROAM" } }),
  ]);

  // Copy email templates to TechRecoil
  const btrTemplates = await prisma.emailTemplate.findMany({
    where: { brandId: "BOOK_TO_ROAM" },
  });
  for (const t of btrTemplates) {
    await prisma.emailTemplate.upsert({
      where: { brandId_key: { brandId: "TECHRECOIL", key: t.key } },
      update: {},
      create: {
        brandId: "TECHRECOIL",
        key: t.key,
        subject: t.subject,
        body: t.body,
      },
    });
  }

  const agencies = await prisma.agencySettings.findMany({
    select: { brandId: true, companyName: true },
  });
  const users = await prisma.user.findMany({
    select: { brandId: true, email: true, name: true },
  });
  console.log("Agencies:", agencies);
  console.log("Users:", users);
  console.log("Done. Existing data stays on Book to Roam. TechRecoil starts empty.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
