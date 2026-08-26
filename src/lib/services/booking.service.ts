import { prisma } from "@/lib/db";
import { getAgencySettings, getActiveDbBrand } from "@/lib/brand-context";
import { allocatePublicRef } from "@/lib/booking-ref";
import { logActivity } from "./activity.service";
import { generateBookingDocuments } from "./document.service";
import { sendBookingNotifications } from "./notification.service";
import { flightFieldsWithDeparture, maybeSendImmediateCheckInAssistanceAlert } from "./checkin-assistance.service";
import { getFlightProvider } from "./provider/flight-provider";
import { upsertHotelProfile } from "./hotel.service";
import { upsertAirlineProfile } from "./airline.service";
import { getAirlineLogoUrl, resolveAirlineIata } from "@/lib/airline-logo";
import { toDbAddonType, validateAddonBooking } from "@/lib/flight-addon";
import { normalizeFlightSegments } from "@/lib/flight-datetime";
import { upsertCustomerFromBooking, getOrCreateCashWalkInCustomer, updateExistingCustomerFromBooking, createBusinessCustomerFromBooking } from "./customer.service";
import { recordCreditTransaction } from "./credit.service";
import type { CashCustomerSnapshot } from "@/lib/cash-customer";
import type {
  BookingChannel,
  BookingStatus,
  PaymentStatus,
  ProductType,
  Prisma,
} from "@prisma/client";
import type { z } from "zod";
import type { offlineBookingSchema, offlineFlightBookingSchema, webhookLiveBookingSchema } from "@/lib/validators/booking";
import { differenceInDays } from "date-fns";
import {
  calculateFlightGst,
  calculateFlightInvoiceTotal,
  FLIGHT_SERVICE_HSN,
  getStateCodeFromGstin,
} from "@/lib/gst-calculator";
import type { FlightPassenger } from "@/types/booking";

type OfflineBookingInput = z.infer<typeof offlineBookingSchema>;
type OfflineFlightBookingInput = z.infer<typeof offlineFlightBookingSchema>;
type WebhookBookingInput = z.infer<typeof webhookLiveBookingSchema>;

async function resolveBookingCustomer(input: {
  billingType: "CASH" | "LEDGER";
  cashBillTo?: "INDIVIDUAL" | "COMPANY";
  ledgerBillTo?: "INDIVIDUAL" | "COMPANY";
  ledgerMode?: "EXISTING" | "NEW";
  customerId?: string;
  customer?: {
    name: string;
    email?: string;
    phone: string;
    pan?: string;
    gstin?: string;
    address?: string;
    city?: string;
    state?: string;
    pincode?: string;
    contactPerson?: string;
  };
}) {
  if (input.billingType === "CASH") {
    if (!input.customer) throw new Error("Customer contact is required for cash bill");
    const walkIn = await getOrCreateCashWalkInCustomer();
    const billTo = input.cashBillTo === "COMPANY" ? "COMPANY" : "INDIVIDUAL";
    const cashCustomer: CashCustomerSnapshot = {
      name: input.customer.name,
      phone: input.customer.phone,
      email: input.customer.email || null,
      pan: input.customer.pan?.toUpperCase() || null,
      gstin: input.customer.gstin || null,
      address: input.customer.address || null,
      city: input.customer.city || null,
      state: input.customer.state || null,
      pincode: input.customer.pincode || null,
      billTo,
      contactPerson: input.customer.contactPerson?.trim() || null,
    };
    return {
      customer: walkIn,
      billingType: "CASH" as const,
      metadata: { cashCustomer } as Prisma.InputJsonValue,
    };
  }

  if (input.ledgerMode === "EXISTING" && input.customerId) {
    if (input.customer) {
      const customer = await updateExistingCustomerFromBooking(input.customerId, input.customer);
      return {
        customer,
        billingType: "LEDGER" as const,
        metadata: undefined,
      };
    }
    const existing = await prisma.customer.findUnique({ where: { id: input.customerId } });
    if (!existing) throw new Error("Selected customer not found");
    return {
      customer: existing,
      billingType: "LEDGER" as const,
      metadata: undefined,
    };
  }

  if (!input.customer) throw new Error("Customer details are required");
  if (input.ledgerBillTo === "COMPANY") {
    const customer = await createBusinessCustomerFromBooking(input.customer);
    return {
      customer,
      billingType: "LEDGER" as const,
      metadata: undefined,
    };
  }
  const customer = await upsertCustomerFromBooking(input.customer);
  return {
    customer,
    billingType: "LEDGER" as const,
    metadata: undefined,
  };
}

async function getAgencyStateCode() {
  try {
    const agency = await getAgencySettings();
    return getStateCodeFromGstin(agency?.gstin);
  } catch {
    // Do not block booking creation if agency settings query fails.
    return null;
  }
}

function validateFlightInvoice(input: OfflineFlightBookingInput, agencyHasGst: boolean) {
  if (input.tripType === "ADDON_SERVICES") {
    validateAddonBooking(
      input.addonType,
      input.passengers,
      input.addonCustomLabel,
      input.addonCustomValue
    );
    if (agencyHasGst && input.baseFare + input.serviceCharge <= 0) {
      throw new Error("Enter service charge or amount for the add-on");
    }
    if (!agencyHasGst && input.totalAmount <= 0) {
      throw new Error("Total amount must be greater than 0");
    }
    return;
  }

  if (agencyHasGst && input.baseFare + input.serviceCharge <= 0) {
    throw new Error("Enter base fare and/or service charge");
  }
  if (!agencyHasGst && input.totalAmount <= 0) {
    throw new Error("Total amount must be greater than 0");
  }
}

function buildFlightTaxData(
  input: OfflineFlightBookingInput,
  agencyStateCode: string | null,
  customerContact: { gstin?: string | null; state?: string | null }
) {
  const buyerGstin =
    input.invoiceTaxType === "ITC"
      ? (input.buyerGstin || customerContact.gstin || "").toUpperCase() || null
      : (input.buyerGstin || customerContact.gstin || "").toUpperCase() || null;

  const tax = calculateFlightGst({
    serviceCharge: input.serviceCharge,
    agencyStateCode,
    buyerGstin,
    buyerState: customerContact.state,
    invoiceTaxType: input.invoiceTaxType,
  });

  const discountAmount = input.discountAmount || 0;
  const invoiceSubtotal = calculateFlightInvoiceTotal(
    input.baseFare,
    input.serviceCharge,
    tax,
    discountAmount
  );
  const paymentGatewayCharge = 0;
  const totalAmount = invoiceSubtotal;

  const airlineLogoUrl = getAirlineLogoUrl(input.airline) || undefined;
  const segments = normalizeFlightSegments(input.segments);

  return {
    totalAmount,
    flightData: flightFieldsWithDeparture({
      airline: input.airline,
      airlineLogoUrl,
      segments,
      passengers: input.passengers,
      tripType: input.tripType || "ONE_WAY",
      addonType: toDbAddonType(input.addonType),
      addonCustomLabel: input.addonCustomLabel?.trim() || null,
      addonCustomValue: input.addonCustomValue?.trim() || null,
      cabinClass: input.cabinClass || "ECONOMY",
      fareType: input.fareType || "NORMAL",
      paymentGatewayCharge: paymentGatewayCharge || null,
      secondaryPnr: input.secondaryPnr || null,
      showEticket: input.showEticket || false,
      showPassengerName: input.showPassengerName !== false,
      checkInAssistance: input.checkInAssistance || false,
      baseFare: input.baseFare,
      serviceCharge: input.serviceCharge,
      discountAmount: discountAmount || null,
      invoiceTaxType: input.invoiceTaxType,
      buyerGstin,
      buyerState: tax.buyerState,
      buyerStateCode: tax.buyerStateCode,
      placeOfSupply: tax.placeOfSupply,
      invoiceNarration: input.invoiceNarration || null,
      msmeNumber: input.msmeNumber || null,
      hsnSac: FLIGHT_SERVICE_HSN,
      cgstRate: tax.cgstRate,
      sgstRate: tax.sgstRate,
      igstRate: tax.igstRate,
      cgstAmount: tax.cgstAmount,
      sgstAmount: tax.sgstAmount,
      igstAmount: tax.igstAmount,
    }),
  };
}

export async function createOfflineBooking(input: OfflineBookingInput, userId?: string) {
  const { customer, billingType, metadata } = await resolveBookingCustomer({
    billingType: input.billingType,
    cashBillTo: input.cashBillTo,
    ledgerBillTo: input.ledgerBillTo,
    ledgerMode: input.ledgerMode,
    customerId: input.customerId,
    customer: input.customer,
  });

  let assignedAgentId: string | null = null;
  if (userId && userId !== "bypass") {
    const agent = await prisma.user.findFirst({
      where: { id: userId, active: true },
      select: { id: true },
    });
    assignedAgentId = agent?.id ?? null;
  }

  const booking = await prisma.$transaction(async (tx) => {
    const brandId = await getActiveDbBrand();
    const { publicRef, serialYear, serialNumber } = await allocatePublicRef(tx, brandId);

    const baseData = {
      brandId,
      publicRef,
      serialYear,
      serialNumber,
      channel: "OFFLINE" as BookingChannel,
      productType: input.productType as ProductType,
      billingType,
      status: "PROCESSING" as BookingStatus,
      paymentStatus: "PENDING" as PaymentStatus,
      totalAmount: input.totalAmount,
      customerId: customer.id,
      assignedAgentId,
      internalNotes: input.internalNotes,
      metadata,
    };

    let created;

    if (input.productType === "FLIGHT") {
      const agency = await getAgencySettings();
      const agencyStateCode = getStateCodeFromGstin(agency?.gstin);
      const agencyHasGst = Boolean(agency?.gstin?.trim());
      const flightInput = input as OfflineFlightBookingInput;
      validateFlightInvoice(flightInput, agencyHasGst);

      let totalAmount = flightInput.totalAmount;
      let flightData: Record<string, unknown> = flightFieldsWithDeparture({
        airline: flightInput.airline,
        segments: flightInput.segments,
        passengers: flightInput.passengers,
        tripType: flightInput.tripType || "ONE_WAY",
        addonType: toDbAddonType(flightInput.addonType),
        addonCustomLabel: flightInput.addonCustomLabel?.trim() || null,
        addonCustomValue: flightInput.addonCustomValue?.trim() || null,
        cabinClass: flightInput.cabinClass || "ECONOMY",
        fareType: flightInput.fareType || "NORMAL",
        paymentGatewayCharge: flightInput.paymentGatewayCharge || null,
        secondaryPnr: flightInput.secondaryPnr || null,
        showEticket: flightInput.showEticket || false,
        showPassengerName: flightInput.showPassengerName !== false,
        checkInAssistance: flightInput.checkInAssistance || false,
        airlineLogoUrl: getAirlineLogoUrl(flightInput.airline) || undefined,
        invoiceNarration: flightInput.invoiceNarration || null,
        msmeNumber: flightInput.msmeNumber || null,
        invoiceTaxType: flightInput.invoiceTaxType,
        cancellationPolicy: flightInput.cancellationPolicy?.trim() || null,
        includeCancellationPolicy: flightInput.includeCancellationPolicy || false,
      });

      if (agencyHasGst) {
        const built = buildFlightTaxData(flightInput, agencyStateCode, {
          gstin: input.customer?.gstin ?? customer.gstin,
          state: input.customer?.state ?? customer.state,
        });
        totalAmount = built.totalAmount;
        flightData = { ...flightData, ...built.flightData };
      } else if (flightInput.paymentGatewayCharge) {
        totalAmount = flightInput.totalAmount;
        flightData.paymentGatewayCharge = flightInput.paymentGatewayCharge;
      }

      created = await tx.booking.create({
        data: {
          ...baseData,
          totalAmount,
          flightBooking: {
            create: flightData as Prisma.FlightBookingUncheckedCreateWithoutBookingInput,
          },
        },
        include: { customer: true, flightBooking: true },
      });
    } else if (input.productType === "HOTEL") {
      const nights = differenceInDays(new Date(input.checkOut), new Date(input.checkIn));
      const hotelProfile = await upsertHotelProfile({
        name: input.propertyName,
        address: input.propertyAddress,
        city: input.city,
        phone: input.propertyPhone,
        email: input.propertyEmail,
        checkInTime: input.checkInTime,
        checkOutTime: input.checkOutTime,
      });

      created = await tx.booking.create({
        data: {
          ...baseData,
          totalAmount: input.totalAmount,
          hotelBooking: {
            create: {
              hotelProfileId: hotelProfile.id,
              propertyName: input.propertyName,
              propertyAddress: input.propertyAddress,
              city: input.city,
              propertyPhone: input.propertyPhone,
              propertyEmail: input.propertyEmail || undefined,
              checkIn: new Date(input.checkIn),
              checkOut: new Date(input.checkOut),
              checkInTime: input.checkInTime || "02:00 PM",
              checkOutTime: input.checkOutTime || "12:00 PM",
              nights: Math.max(nights, 1),
              roomsCount: input.roomsCount || 1,
              roomType: input.roomType,
              mealPlan: input.mealPlan || "ROOM_ONLY",
              roomAmenities: input.roomAmenities || [],
              adultsCount: input.adultsCount || 1,
              childrenCount: input.childrenCount || 0,
              guests: input.guests || [],
              inclusions: input.inclusions,
              cancellationPolicy: input.cancellationPolicy,
              includeCancellationPolicy: input.includeCancellationPolicy || false,
              policies: input.policies,
              agentRemarks: input.agentRemarks,
            },
          },
        },
        include: { customer: true, hotelBooking: true },
      });
    } else {
      created = await tx.booking.create({
        data: {
          ...baseData,
          totalAmount: input.totalAmount,
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
        },
        include: { customer: true, busBooking: true },
      });
    }

    return created!;
  });

  if (billingType === "LEDGER") {
    await recordCreditTransaction({
      customerId: customer.id,
      bookingId: booking.id,
      type: "DEBIT",
      amount: Number(booking.totalAmount),
      note: `Booking ${booking.publicRef}`,
      createdById: userId && userId !== "bypass" ? userId : undefined,
    });
  }

  if (input.productType === "HOTEL") {
    const documents = await generateBookingDocuments(booking.id, userId);
    await sendBookingNotifications(booking.id, "booking_confirmed", {
      documentPaths: documents.map((doc) => doc.storagePath),
      userId,
    });
    await prisma.booking.update({
      where: { id: booking.id },
      data: { status: "TICKET_SENT" },
    });
    const hotelBooking = await prisma.booking.findUniqueOrThrow({
      where: { id: booking.id },
      include: { customer: true, hotelBooking: true },
    });

    try {
      await logActivity({
        bookingId: hotelBooking.id,
        userId: userId && userId !== "bypass" ? userId : undefined,
        action: "BOOKING_CREATED",
        details: { channel: "OFFLINE", productType: input.productType },
      });
    } catch {
      // Non-critical.
    }

    return hotelBooking;
  }

  try {
    await logActivity({
      bookingId: booking.id,
      userId: userId && userId !== "bypass" ? userId : undefined,
      action: "BOOKING_CREATED",
      details: { channel: "OFFLINE", productType: input.productType },
    });
  } catch {
    // Non-critical. Booking is already created.
  }

  if (input.productType === "FLIGHT") {
    const flightInput = input as OfflineFlightBookingInput;
    try {
      const documents = await generateBookingDocuments(booking.id, userId);
      await sendBookingNotifications(booking.id, "itinerary_voucher", {
        documentPaths: documents.map((doc) => doc.storagePath),
        userId,
      });
      await logActivity({
        bookingId: booking.id,
        userId: userId && userId !== "bypass" ? userId : undefined,
        action: "ITINERARY_VOUCHER_SENT",
        details: { channel: "OFFLINE" },
      });
    } catch (err) {
      console.error("Failed to send itinerary voucher:", err);
    }
    if (flightInput.checkInAssistance) {
      try {
        await maybeSendImmediateCheckInAssistanceAlert(booking.id);
      } catch {
        // Non-critical - cron will retry.
      }
    }
  }

  return booking;
}

export async function createHeldBooking(input: WebhookBookingInput) {
  const customer = await upsertCustomerFromBooking(input.customer);
  const { publicRef, serialYear, serialNumber } = await allocatePublicRef();

  const booking = await createBookingFromWebhook({
    input,
    customerId: customer.id,
    publicRef,
    serialYear,
    serialNumber,
    channel: "HELD",
    status: "PROCESSING",
  });

  await sendBookingNotifications(booking.id, "held_processing");
  return booking;
}

export async function createLiveBooking(input: WebhookBookingInput) {
  const customer = await upsertCustomerFromBooking(input.customer);
  const { publicRef, serialYear, serialNumber } = await allocatePublicRef();

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
    serialYear,
    serialNumber,
    channel: "LIVE_API",
    status: "CONFIRMED",
    pnr,
    supplierRef,
    metadata,
  });

  const documents = await generateBookingDocuments(booking.id);
  await prisma.booking.update({
    where: { id: booking.id },
    data: { status: "TICKET_SENT" },
  });
  await sendBookingNotifications(booking.id, "booking_confirmed", {
    documentPaths: documents.map((doc) => doc.storagePath),
  });

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
  serialYear: number;
  serialNumber: number;
  channel: BookingChannel;
  status: BookingStatus;
  pnr?: string;
  supplierRef?: string;
  metadata?: Prisma.InputJsonValue;
}) {
  const { input, customerId, publicRef, serialYear, serialNumber, channel, status, pnr, supplierRef, metadata } = params;
  const brandId = await getActiveDbBrand();

  const base = {
    brandId,
    publicRef,
    serialYear,
    serialNumber,
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
        brandId,
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
          create: flightFieldsWithDeparture({
            airline: input.flight.airline,
            segments: input.flight.segments,
            passengers: input.flight.passengers,
            checkInAssistance: false,
          }),
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
            guests: input.hotel.guests || [],
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

async function applyFlightPassengerTicketNumbers(
  bookingId: string,
  ticketNumbers?: string[]
) {
  const flight = await prisma.flightBooking.findUnique({ where: { bookingId } });
  if (!flight) return;

  const passengers = flight.passengers as unknown as FlightPassenger[];
  const hasIncoming = Boolean(ticketNumbers?.length);

  const merged = passengers.map((p, i) => ({
    ...p,
    ticketNumber: hasIncoming
      ? ticketNumbers?.[i]?.trim() || p.ticketNumber?.trim() || ""
      : p.ticketNumber?.trim() || "",
  }));

  if (flight.showEticket) {
    const missing = merged.find((p) => !p.ticketNumber);
    if (missing) {
      throw new Error("E-ticket number is required for all passengers on international e-ticket bookings");
    }
  }

  if (hasIncoming) {
    await prisma.flightBooking.update({
      where: { bookingId },
      data: { passengers: merged },
    });
  }
}

export async function confirmBookingPnr(
  bookingId: string,
  pnr: string,
  supplierRef: string | undefined,
  userId: string,
  secondaryPnr?: string,
  ticketNumbers?: string[]
) {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { documents: true, hotelBooking: true, flightBooking: true },
  });
  if (!booking) throw new Error("Booking not found");

  const isInitialConfirm = ["PROCESSING", "FAILED"].includes(booking.status);
  const isResume =
    booking.status === "CONFIRMED" && booking.documents.length === 0;
  const isHotelSupplierConfirm =
    booking.productType === "HOTEL" &&
    booking.status === "TICKET_SENT" &&
    !booking.hotelBooking?.confirmationNo;

  if (!isInitialConfirm && !isResume && !isHotelSupplierConfirm) {
    if (booking.status === "TICKET_SENT" && booking.productType !== "HOTEL") {
      throw new Error("Ticket already sent for this booking");
    }
    if (booking.status === "TICKET_SENT" && booking.hotelBooking?.confirmationNo) {
      throw new Error("Supplier confirmation already added for this booking");
    }
    throw new Error("Booking cannot be confirmed in current status");
  }

  let updated = booking;

  if (isInitialConfirm || isHotelSupplierConfirm) {
    updated = await prisma.booking.update({
      where: { id: bookingId },
      data: {
        pnr,
        supplierRef,
        status: booking.productType === "HOTEL" ? "TICKET_SENT" : "CONFIRMED",
        confirmedAt: new Date(),
      },
      include: { customer: true, documents: true, hotelBooking: true, flightBooking: true },
    });

    if (booking.productType === "HOTEL") {
      await prisma.hotelBooking.updateMany({
        where: { bookingId },
        data: { confirmationNo: pnr },
      });
    }

    if (booking.productType === "FLIGHT" && booking.flightBooking) {
      await upsertAirlineProfile({
        name: booking.flightBooking.airline,
        iataCode: resolveAirlineIata(booking.flightBooking.airline) || undefined,
        logoUrl: booking.flightBooking.airlineLogoUrl || undefined,
      });
      if (secondaryPnr) {
        await prisma.flightBooking.update({
          where: { bookingId },
          data: { secondaryPnr },
        });
      }
    }

    await logActivity({
      bookingId,
      userId,
      action: "PNR_CONFIRMED",
      details: { pnr, supplierRef },
    });
  }

  if (booking.productType === "FLIGHT") {
    await applyFlightPassengerTicketNumbers(bookingId, ticketNumbers);
  }

  const documents = await generateBookingDocuments(bookingId, userId);
  await prisma.booking.update({
    where: { id: bookingId },
    data: { status: "TICKET_SENT" },
  });
  await sendBookingNotifications(bookingId, "booking_confirmed", {
    documentPaths: documents.map((doc) => doc.storagePath),
    userId,
  });

  return prisma.booking.findUnique({
    where: { id: bookingId },
    include: { customer: true },
  });
}

export async function sendItineraryWithPnr(
  bookingId: string,
  pnr: string,
  userId: string,
  secondaryPnr?: string,
  ticketNumbers?: string[]
) {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { flightBooking: true },
  });
  if (!booking) throw new Error("Booking not found");
  if (booking.productType !== "FLIGHT") {
    throw new Error("Itinerary send is only available for flight bookings");
  }

  await prisma.booking.update({
    where: { id: bookingId },
    data: { pnr, supplierRef: booking.supplierRef },
  });

  if (secondaryPnr && booking.flightBooking) {
    await prisma.flightBooking.update({
      where: { bookingId },
      data: { secondaryPnr },
    });
  }

  if (booking.flightBooking) {
    await upsertAirlineProfile({
      name: booking.flightBooking.airline,
      iataCode: resolveAirlineIata(booking.flightBooking.airline) || undefined,
    });
  }

  await applyFlightPassengerTicketNumbers(bookingId, ticketNumbers);

  const documents = await generateBookingDocuments(bookingId, userId);
  await prisma.booking.update({
    where: { id: bookingId },
    data: { status: "TICKET_SENT", confirmedAt: new Date() },
  });
  await sendBookingNotifications(bookingId, "booking_confirmed", {
    documentPaths: documents.map((doc) => doc.storagePath),
    userId,
  });

  await logActivity({
    bookingId,
    userId,
    action: "ITINERARY_SENT",
    details: { pnr, secondaryPnr },
  });
}

export async function resendBookingEmail(bookingId: string, userId: string) {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { documents: true },
  });
  if (!booking) throw new Error("Booking not found");

  const documents = await generateBookingDocuments(bookingId, userId);

  const templateKey =
    ["CONFIRMED", "TICKET_SENT"].includes(booking.status) || booking.pnr
      ? "booking_confirmed"
      : booking.productType === "FLIGHT"
        ? "itinerary_voucher"
        : "held_processing";

  const results = await sendBookingNotifications(bookingId, templateKey, {
    documentPaths: documents.map((doc) => doc.storagePath),
    userId,
  });

  const email = results.email as { success?: boolean; skipped?: boolean; error?: string } | undefined;
  if (email?.skipped) {
    throw new Error("Customer has no email address - add an email on the customer profile.");
  }
  if (email && email.success === false) {
    throw new Error(email.error || "Failed to send email");
  }

  await logActivity({
    bookingId,
    userId,
    action: "NOTIFICATIONS_RESENT",
    details: { template: templateKey, channels: ["email", "whatsapp"] },
  });

  return results;
}

export async function getDashboardStats() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const weekAgo = new Date(today);
  weekAgo.setDate(weekAgo.getDate() - 7);

  const brandId = await getActiveDbBrand();
  const brandFilter = { brandId };

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
    prisma.booking.count({ where: { ...brandFilter, createdAt: { gte: today } } }),
    prisma.booking.count({
      where: { ...brandFilter, createdAt: { gte: yesterday, lt: today } },
    }),
    prisma.booking.count({ where: { ...brandFilter, status: "PROCESSING" } }),
    prisma.booking.count({ where: { ...brandFilter, status: "PROCESSING", pnr: null } }),
    prisma.booking.aggregate({
      where: { ...brandFilter, paymentStatus: "PAID" },
      _sum: { totalAmount: true },
    }),
    prisma.booking.aggregate({
      where: { ...brandFilter, paymentStatus: "PAID", createdAt: { gte: weekAgo } },
      _sum: { totalAmount: true },
    }),
    prisma.booking.count({ where: { ...brandFilter, status: "CONFIRMED" } }),
    prisma.booking.count({ where: { ...brandFilter, status: "TICKET_SENT" } }),
    prisma.booking.count({ where: brandFilter }),
    prisma.booking.groupBy({ by: ["channel"], where: brandFilter, _count: true }),
    prisma.booking.groupBy({ by: ["productType"], where: brandFilter, _count: true }),
    prisma.booking.groupBy({ by: ["status"], where: brandFilter, _count: true }),
    prisma.booking.findMany({
      where: { ...brandFilter, status: "PROCESSING" },
      include: { customer: true },
      orderBy: { createdAt: "asc" },
      take: 8,
    }),
    prisma.booking.findMany({
      where: brandFilter,
      include: { customer: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      take: 6,
    }),
    prisma.activityLog.findMany({
      where: { booking: brandFilter },
      include: {
        user: { select: { name: true } },
        booking: { select: { id: true, publicRef: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 8,
    }),
    prisma.booking.findMany({
      where: { ...brandFilter, createdAt: { gte: weekAgo }, paymentStatus: "PAID" },
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
