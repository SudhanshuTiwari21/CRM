import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const DEMO_BOOKING_REF = "FB-2026-000001";
const DEMO_CUSTOMER_ID = "seed-customer-1";

async function main() {
  const booking = await prisma.booking.findFirst({
    where: { publicRef: DEMO_BOOKING_REF },
    select: { id: true, publicRef: true },
  });

  if (booking) {
    await prisma.booking.delete({ where: { id: booking.id } });
    console.log(`Deleted booking ${booking.publicRef}`);
  } else {
    console.log(`No booking found: ${DEMO_BOOKING_REF}`);
  }

  const customer = await prisma.customer.findUnique({
    where: { id: DEMO_CUSTOMER_ID },
    include: { _count: { select: { bookings: true } } },
  });

  if (customer) {
    if (customer._count.bookings > 0) {
      console.log(`Customer ${customer.name} still has bookings - skipped delete`);
    } else {
      await prisma.customer.delete({ where: { id: DEMO_CUSTOMER_ID } });
      console.log(`Deleted customer ${customer.name}`);
    }
  } else {
    console.log(`No customer found: ${DEMO_CUSTOMER_ID}`);
  }

  // Remove orphan activity logs from deleted demo booking
  const removedLogs = await prisma.activityLog.deleteMany({
    where: {
      bookingId: null,
      details: { path: ["note"], equals: "Seed booking for demo" },
    },
  });
  if (removedLogs.count > 0) {
    console.log(`Removed ${removedLogs.count} demo activity log(s)`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
