import { prisma } from "@/lib/db";
import { generatePublicRef } from "@/lib/booking-ref";
import { logActivity } from "./activity.service";
import { generateBookingDocuments, getBookingDocumentPaths } from "./document.service";
import { sendTemplatedEmail, getEmailAttachments } from "@/lib/mailer";
import { getFlightProvider } from "./provider/flight-provider";
import type {
  BookingChannel,
  BookingStatus,
  PaymentStatus,
  ProductType,
  Prisma,
} from "@prisma/client";
import type { z } from "zod";
import type { offlineBookingSchema, webhookLiveBookingSchema } from "@/lib/validators/booking";
import { differenceInDays } from "date-fns";

type OfflineBookingInput = z.infer<typeof offlineBookingSchema>;
type WebhookBookingInput = z.infer<typeof webhookLiveBookingSchema>;

async function upsertCustomer(customer: { name: string; email?: string; phone: string; gstin?: string; address?: string }) {
  const existing = await prisma.customer.findFirst({
    where: { phone: customer.phone },
  });

  if (existing) {
    return prisma.customer.update({
      where: { id: existing.id },
      data: {
        name: customer.name,
        email: customer.email || existing.email,
        gstin: customer.gstin || existing.gstin,
        address: customer.address || existing.address,
      },
    });
  }

  return prisma.customer.create({ data: customer });
}

async function sendBookingEmails(bookingId: string, templateKey: "held_processing" | "booking_confirmed") {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { customer: true },
  });
  const agency = await prisma.agencySettings.findUnique({ where: { id: "default" } });

  if (!booking?.customer.email) return;

  const vars = {
    customerName: booking.customer.name,
    publicRef: booking.publicRef,
    productType: booking.productType,
    amount: `₹${Number(booking.totalAmount).toLocaleString("en-IN")}`,
    pnr: booking.pnr || "Pending",
    companyName: agency?.companyName || "Book to Roam",
    companyPhone: agency?.phone || "",
  };

  let attachments;
  if (templateKey === "booking_confirmed") {
    const paths = await getBookingDocumentPaths(bookingId);
    attachments = await getEmailAttachments(paths);
  }

  await sendTemplatedEmail({
    templateKey,
    to: booking.customer.email,
    vars,
    bookingId,
    attachments,
  });
}

export async function createOfflineBooking(input: OfflineBookingInput, userId: string) {
  const customer = await upsertCustomer(input.customer);
  const publicRef = await generatePublicRef();

  const baseData = {
    publicRef,
    channel: "OFFLINE" as BookingChannel,
    productType: input.productType as ProductType,
    status: "PROCESSING" as BookingStatus,
    paymentStatus: (input.paymentMethod ? "PAID" : "PENDING") as PaymentStatus,
    totalAmount: input.totalAmount,
    customerId: customer.id,
    assignedAgentId: userId,
    internalNotes: input.internalNotes,
  };

  let booking;

  if (input.productType === "FLIGHT") {
    booking = await prisma.booking.create({
      data: {
        ...baseData,
        flightBooking: {
          create: {
            airline: input.airline,
            segments: input.segments,
            passengers: input.passengers,
          },
        },
        ...(input.paymentMethod
          ? {
              payments: {
                create: {
                  amount: input.totalAmount,
                  method: input.paymentMethod,
                  status: "PAID",
                },
              },
            }
          : {}),
      },
      include: { customer: true, flightBooking: true },
    });
  } else if (input.productType === "HOTEL") {
    const nights = differenceInDays(new Date(input.checkOut), new Date(input.checkIn));
    booking = await prisma.booking.create({
      data: {
        ...baseData,
        hotelBooking: {
          create: {
            propertyName: input.propertyName,
            propertyAddress: input.propertyAddress,
            checkIn: new Date(input.checkIn),
            checkOut: new Date(input.checkOut),
            nights: Math.max(nights, 1),
            roomType: input.roomType,
            guests: input.guests,
            policies: input.policies,
            agentRemarks: input.agentRemarks,
          },
        },
        ...(input.paymentMethod
          ? {
              payments: {
                create: {
                  amount: input.totalAmount,
                  method: input.paymentMethod,
                  status: "PAID",
                },
              },
            }
          : {}),
      },
      include: { customer: true, hotelBooking: true },
    });
  } else {
    booking = await prisma.booking.create({
      data: {
        ...baseData,
        busBooking: {
          create: {
            operator: input.operator,
            route: input.route,
            boardingPoint: input.boardingPoint,
            droppingPoint: input.droppingPoint,
            departureAt: new Date(input.departureAt),
            arrivalAt: new Date(input.arrivalAt),
            seats: input.seats,
            passengers: input.passengers,
          },
        },
        ...(input.paymentMethod
          ? {
              payments: {
                create: {
                  amount: input.totalAmount,
                  method: input.paymentMethod,
                  status: "PAID",
                },
              },
            }
          : {}),
      },
      include: { customer: true, busBooking: true },
    });
  }

  await logActivity({
    bookingId: booking.id,
    userId,
    action: "BOOKING_CREATED",
    details: { channel: "OFFLINE", productType: input.productType },
  });

  return booking;
}

export async function createHeldBooking(input: WebhookBookingInput) {
  const customer = await upsertCustomer(input.customer);
  const publicRef = await generatePublicRef();

  const booking = await createBookingFromWebhook({
    input,
    customerId: customer.id,
    publicRef,
    channel: "HELD",
    status: "PROCESSING",
  });

  await sendBookingEmails(booking.id, "held_processing");
  return booking;
}

export async function createLiveBooking(input: WebhookBookingInput) {
  const customer = await upsertCustomer(input.customer);
  const publicRef = await generatePublicRef();

  let pnr: string | undefined;
  let supplierRef: string | undefined;
  let metadata: Prisma.InputJsonValue | undefined;

  if (input.productType === "FLIGHT" && input.flight) {
    const provider = getFlightProvider();
    const result = await provider.bookFlight({
      airline: input.flight.airline,
      segments: input.flight.segments,
      passengers: input.flight.passengers,
      totalAmount: input.totalAmount,
    });
    pnr = result.pnr;
    supplierRef = result.supplierRef;
    metadata = { providerResponse: result.rawResponse as Prisma.InputJsonValue };
  } else {
    pnr = `CNF${Date.now().toString().slice(-6)}`;
    supplierRef = `LIVE-${Date.now()}`;
  }

  const booking = await createBookingFromWebhook({
    input,
    customerId: customer.id,
    publicRef,
    channel: "LIVE_API",
    status: "CONFIRMED",
    pnr,
    supplierRef,
    metadata,
  });

  await generateBookingDocuments(booking.id);
  await prisma.booking.update({
    where: { id: booking.id },
    data: { status: "TICKET_SENT" },
  });
  await sendBookingEmails(booking.id, "booking_confirmed");

  await logActivity({
    bookingId: booking.id,
    action: "LIVE_BOOKING_CONFIRMED",
    details: { pnr, supplierRef },
  });

  return booking;
}

async function createBookingFromWebhook(params: {
  input: WebhookBookingInput;
  customerId: string;
  publicRef: string;
  channel: BookingChannel;
  status: BookingStatus;
  pnr?: string;
  supplierRef?: string;
  metadata?: Prisma.InputJsonValue;
}) {
  const { input, customerId, publicRef, channel, status, pnr, supplierRef, metadata } = params;

  const base = {
    publicRef,
    channel,
    productType: input.productType as ProductType,
    status,
    paymentStatus: "PAID" as PaymentStatus,
    totalAmount: input.totalAmount,
    customerId,
    pnr,
    supplierRef,
    confirmedAt: status === "CONFIRMED" ? new Date() : undefined,
    metadata,
    payments: {
      create: {
        amount: input.totalAmount,
        method: input.paymentMethod,
        gatewayRef: input.gatewayRef,
        status: "PAID" as PaymentStatus,
      },
    },
  };

  if (input.productType === "FLIGHT" && input.flight) {
    return prisma.booking.create({
      data: {
        ...base,
        flightBooking: {
          create: {
            airline: input.flight.airline,
            segments: input.flight.segments,
            passengers: input.flight.passengers,
          },
        },
      },
      include: { customer: true, flightBooking: true },
    });
  }

  if (input.productType === "HOTEL" && input.hotel) {
    const nights = differenceInDays(new Date(input.hotel.checkOut), new Date(input.hotel.checkIn));
    return prisma.booking.create({
      data: {
        ...base,
        hotelBooking: {
          create: {
            propertyName: input.hotel.propertyName,
            propertyAddress: input.hotel.propertyAddress,
            checkIn: new Date(input.hotel.checkIn),
            checkOut: new Date(input.hotel.checkOut),
            nights: Math.max(nights, 1),
            roomType: input.hotel.roomType,
            guests: input.hotel.guests,
          },
        },
      },
      include: { customer: true, hotelBooking: true },
    });
  }

  if (input.productType === "BUS" && input.bus) {
    return prisma.booking.create({
      data: {
        ...base,
        busBooking: {
          create: {
            operator: input.bus.operator,
            route: input.bus.route,
            boardingPoint: input.bus.boardingPoint,
            droppingPoint: input.bus.droppingPoint,
            departureAt: new Date(input.bus.departureAt),
            arrivalAt: new Date(input.bus.arrivalAt),
            seats: input.bus.seats,
            passengers: input.bus.passengers,
          },
        },
      },
      include: { customer: true, busBooking: true },
    });
  }

  throw new Error("Invalid booking payload for product type");
}

export async function confirmBookingPnr(bookingId: string, pnr: string, supplierRef: string | undefined, userId: string) {
  const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
  if (!booking) throw new Error("Booking not found");
  if (!["PROCESSING", "FAILED"].includes(booking.status)) {
    throw new Error("Booking cannot be confirmed in current status");
  }

  const updated = await prisma.booking.update({
    where: { id: bookingId },
    data: {
      pnr,
      supplierRef,
      status: "CONFIRMED",
      confirmedAt: new Date(),
    },
    include: { customer: true },
  });

  if (booking.productType === "HOTEL") {
    await prisma.hotelBooking.updateMany({
      where: { bookingId },
      data: { confirmationNo: pnr },
    });
  }

  await logActivity({
    bookingId,
    userId,
    action: "PNR_CONFIRMED",
    details: { pnr, supplierRef },
  });

  await generateBookingDocuments(bookingId, userId);
  await prisma.booking.update({
    where: { id: bookingId },
    data: { status: "TICKET_SENT" },
  });
  await sendBookingEmails(bookingId, "booking_confirmed");

  return updated;
}

export async function resendBookingEmail(bookingId: string, userId: string) {
  const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
  if (!booking) throw new Error("Booking not found");

  const templateKey = ["CONFIRMED", "TICKET_SENT"].includes(booking.status)
    ? "booking_confirmed"
    : "held_processing";

  await sendBookingEmails(bookingId, templateKey);

  await logActivity({
    bookingId,
    userId,
    action: "EMAIL_RESENT",
    details: { template: templateKey },
  });
}

export async function getDashboardStats() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const weekAgo = new Date(today);
  weekAgo.setDate(weekAgo.getDate() - 7);

  const [
    todayBookings,
    yesterdayBookings,
    processingCount,
    pendingPnr,
    revenue,
    weekRevenue,
    confirmedCount,
    ticketSentCount,
    totalBookings,
    byChannel,
    byProduct,
    byStatus,
    processingQueue,
    recentBookings,
    recentActivity,
    weekBookings,
  ] = await Promise.all([
    prisma.booking.count({ where: { createdAt: { gte: today } } }),
    prisma.booking.count({
      where: { createdAt: { gte: yesterday, lt: today } },
    }),
    prisma.booking.count({ where: { status: "PROCESSING" } }),
    prisma.booking.count({ where: { status: "PROCESSING", pnr: null } }),
    prisma.booking.aggregate({
      where: { paymentStatus: "PAID" },
      _sum: { totalAmount: true },
    }),
    prisma.booking.aggregate({
      where: { paymentStatus: "PAID", createdAt: { gte: weekAgo } },
      _sum: { totalAmount: true },
    }),
    prisma.booking.count({ where: { status: "CONFIRMED" } }),
    prisma.booking.count({ where: { status: "TICKET_SENT" } }),
    prisma.booking.count(),
    prisma.booking.groupBy({ by: ["channel"], _count: true }),
    prisma.booking.groupBy({ by: ["productType"], _count: true }),
    prisma.booking.groupBy({ by: ["status"], _count: true }),
    prisma.booking.findMany({
      where: { status: "PROCESSING" },
      include: { customer: true },
      orderBy: { createdAt: "asc" },
      take: 8,
    }),
    prisma.booking.findMany({
      include: { customer: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      take: 6,
    }),
    prisma.activityLog.findMany({
      include: {
        user: { select: { name: true } },
        booking: { select: { id: true, publicRef: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 8,
    }),
    prisma.booking.findMany({
      where: { createdAt: { gte: weekAgo }, paymentStatus: "PAID" },
      select: { createdAt: true, totalAmount: true },
    }),
  ]);

  const revenueByDay: { date: string; label: string; revenue: number; bookings: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split("T")[0];
    const dayBookings = weekBookings.filter(
      (b) => b.createdAt.toISOString().split("T")[0] === dateStr
    );
    revenueByDay.push({
      date: dateStr,
      label: d.toLocaleDateString("en-IN", { weekday: "short", day: "numeric" }),
      revenue: dayBookings.reduce((s, b) => s + Number(b.totalAmount), 0),
      bookings: dayBookings.length,
    });
  }

  return {
    todayBookings,
    yesterdayBookings,
    processingCount,
    pendingPnr,
    totalRevenue: Number(revenue._sum.totalAmount || 0),
    weekRevenue: Number(weekRevenue._sum.totalAmount || 0),
    confirmedCount,
    ticketSentCount,
    totalBookings,
    byChannel: byChannel.map((c) => ({ name: c.channel, value: c._count })),
    byProduct: byProduct.map((p) => ({ name: p.productType, value: p._count })),
    byStatus: byStatus.map((s) => ({ name: s.status, value: s._count })),
    processingQueue,
    recentBookings,
    recentActivity,
    revenueByDay,
  };
}
