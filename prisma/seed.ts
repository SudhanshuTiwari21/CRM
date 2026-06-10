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
    update: {},
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

  const customer = await prisma.customer.upsert({
    where: { id: "seed-customer-1" },
    update: {},
    create: {
      id: "seed-customer-1",
      name: "Robert Handique",
      email: "robert.handique@example.com",
      phone: "9876543210",
      address: "Kolkata, West Bengal",
    },
  });

  const booking = await prisma.booking.upsert({
    where: { publicRef: "FB-2026-000001" },
    update: {},
    create: {
      publicRef: "FB-2026-000001",
      channel: "HELD",
      productType: "FLIGHT",
      status: "PROCESSING",
      paymentStatus: "PAID",
      totalAmount: 18500,
      currency: "INR",
      customerId: customer.id,
      assignedAgentId: agent.id,
      metadata: { source: "seed" },
      flightBooking: {
        create: {
          airline: "IndiGo",
          segments: [
            {
              flightNumber: "6E 212",
              airline: "IndiGo",
              fromAirport: "CCU",
              fromCity: "Kolkata",
              toAirport: "GAU",
              toCity: "Guwahati",
              departureAt: "2026-05-28T09:00:00",
              arrivalAt: "2026-05-28T10:15:00",
              terminal: "Terminal 1",
              aircraft: "A320",
              duration: "1h 15m",
              status: "Confirmed",
            },
          ],
          passengers: [
            { title: "Mr", firstName: "Robert", lastName: "Handique", gender: "Male" },
            { title: "Mrs", firstName: "Barnali", lastName: "Barbaruah", gender: "Female" },
            { title: "Mr", firstName: "Aarish", lastName: "Handique", gender: "Male" },
            { title: "Ms", firstName: "Adveeka", lastName: "Handique", gender: "Female" },
          ],
        },
      },
      payments: {
        create: {
          amount: 18500,
          method: "UPI",
          gatewayRef: "PAY_SEED_001",
          status: "PAID",
        },
      },
      activityLogs: {
        create: {
          userId: admin.id,
          action: "BOOKING_CREATED",
          details: { channel: "HELD", note: "Seed booking for demo" },
        },
      },
    },
  });

  console.log("Seed completed:", { admin: admin.email, agent: agent.email, booking: booking.publicRef });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
