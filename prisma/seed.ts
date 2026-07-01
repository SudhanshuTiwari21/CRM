import { PrismaClient, UserRole } from "@prisma/client";
import { hash } from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const adminPassword = await hash("admin123", 12);
  const agentPassword = await hash("agent123", 12);

  const admin = await prisma.user.upsert({
    where: { email: "admin@techrecoil.in" },
    update: {},
    create: {
      name: "Admin User",
      email: "admin@techrecoil.in",
      passwordHash: adminPassword,
      role: UserRole.ADMIN,
    },
  });

  const agent = await prisma.user.upsert({
    where: { email: "agent@techrecoil.in" },
    update: {},
    create: {
      name: "Travel Agent",
      email: "agent@techrecoil.in",
      passwordHash: agentPassword,
      role: UserRole.AGENT,
    },
  });

  const smtpUser = process.env.SMTP_USER || "";
  await prisma.agencySettings.upsert({
    where: { id: "default" },
    update: {
      smtpHost: process.env.SMTP_HOST || "smtp.gmail.com",
      smtpPort: parseInt(process.env.SMTP_PORT || "587", 10),
      smtpUser: smtpUser || undefined,
      smtpFrom: process.env.SMTP_FROM || (smtpUser ? `Book to Roam <${smtpUser}>` : undefined),
      companyName: "Book to Roam",
    },
    create: {
      id: "default",
      companyName: "Book to Roam",
      address: "136 Bangur Avenue Block C",
      city: "Kolkata",
      state: "West Bengal",
      pincode: "700055",
      gstin: "19BNRPA5295C1ZS",
      phone: "9874133113",
      email: "techrecoil@yahoo.in",
      invoicePrefix: "INV",
      webhookApiKey: process.env.WEBHOOK_API_KEY || "dev-webhook-key-change-me",
      holdModeEnabled: false,
      smtpHost: process.env.SMTP_HOST || "smtp.gmail.com",
      smtpPort: parseInt(process.env.SMTP_PORT || "587", 10),
      smtpUser: smtpUser || undefined,
      smtpFrom: process.env.SMTP_FROM || (smtpUser ? `Book to Roam <${smtpUser}>` : undefined),
    },
  });

  await prisma.emailTemplate.upsert({
    where: { key: "held_processing" },
    update: {},
    create: {
      key: "held_processing",
      subject: "Booking Received - {{publicRef}}",
      body: `Dear {{customerName}},

Thank you for your booking with {{companyName}}.

Your booking has been received and is being processed. You will receive your confirmed ticket within 24-48 hours.

Booking ID: {{publicRef}}
Product: {{productType}}
Amount Paid: {{amount}}

We will notify you shortly once your booking is confirmed.

Regards,
{{companyName}}
{{companyPhone}}`,
    },
  });

  await prisma.emailTemplate.upsert({
    where: { key: "booking_confirmed" },
    update: {
      subject: "Booking Confirmed - {{publicRef}} | PNR: {{pnr}}",
    },
    create: {
      key: "booking_confirmed",
      subject: "Booking Confirmed - {{publicRef}} | PNR: {{pnr}}",
      body: `Dear {{customerName}},

Great news! Your booking has been confirmed.

Booking ID: {{publicRef}}
PNR / Confirmation: {{pnr}}
Product: {{productType}}

Please find your ticket and invoice attached to this email.

Regards,
{{companyName}}
{{companyPhone}}`,
    },
  });

  await prisma.emailTemplate.upsert({
    where: { key: "itinerary_voucher" },
    update: {
      subject: "Your Flight Booking - {{publicRef}}",
    },
    create: {
      key: "itinerary_voucher",
      subject: "Your Flight Booking - {{publicRef}}",
      body: `Dear {{customerName}},

Thank you for booking with {{companyName}}.

Your flight booking has been confirmed. Your e-ticket number with PNR will be shared within a maximum of 24 hours.

Booking ID: {{publicRef}}
Amount: {{amount}}

Your booking voucher and invoice are attached to this email.

Regards,
{{companyName}}
{{companyPhone}}`,
    },
  });

  await prisma.emailTemplate.upsert({
    where: { key: "checkin_assistance_reminder" },
    update: {},
    create: {
      key: "checkin_assistance_reminder",
      subject: "Check-in Assistance — {{publicRef}} departs in ~{{hoursLeft}}h",
      body: `Check-in booking assistance required.

Booking: {{publicRef}}
Customer: {{customerName}} ({{customerPhone}})
PNR: {{pnr}}
Airline: {{airline}}
Sector: {{sector}}
Departure: {{departureAt}}
Time until departure: ~{{hoursLeft}} hours

Please follow up with the customer for check-in assistance.

{{companyName}}`,
    },
  });

  console.log("Seed completed:", { admin: admin.email, agent: agent.email });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
