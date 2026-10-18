import fs from "fs/promises";
import { differenceInDays } from "date-fns";
import { prisma } from "@/lib/db";
import { getAgencySettings } from "@/lib/brand-context";
import type { Prisma } from "@prisma/client";
import { formatPublicRef, parsePublicRef } from "@/lib/booking-ref";
import { getAirlineLogoUrl } from "@/lib/airline-logo";
import {
  calculateFlightGst,
  calculateFlightInvoiceTotal,
  FLIGHT_SERVICE_HSN,
  HOTEL_SERVICE_HSN,
  getStateCodeFromGstin,
} from "@/lib/gst-calculator";
import { applyCardGatewayCharge } from "@/lib/payment-gateway";
import type { FlightPassenger, FlightSegment, HotelGuest } from "@/types/booking";
import { normalizeFlightSegments } from "@/lib/flight-datetime";
import { normalizeHotelRooms, totalsFromHotelRooms } from "@/lib/hotel-rooms";
import { logActivity } from "./activity.service";
import { generateBookingDocuments } from "./document.service";
import { recordBookingPayment } from "./booking-payment.service";
import { computeAmountDue, sumPaidPayments } from "@/lib/payment-utils";
import { flightFieldsWithDeparture, maybeSendImmediateCheckInAssistanceAlert } from "./checkin-assistance.service";
import { toDbAddonType } from "@/lib/flight-addon";
import { formatCustomerName } from "@/lib/utils";
import { updateExistingCustomerFromBooking } from "./customer.service";
import type { CashCustomerSnapshot, CashBillTo } from "@/lib/cash-customer";
import { parseCashCustomerSnapshot } from "@/lib/cash-customer";
import { upsertHotelProfile } from "./hotel.service";
import { validateCashBillAmountAndPan } from "@/lib/cash-compliance";

import type { z } from "zod";
import type { adminBookingUpdateSchema } from "@/lib/validators/booking-admin";
import type { RecordBookingPaymentInput } from "@/lib/validators/payment";

type AdminBookingUpdateInput = z.infer<typeof adminBookingUpdateSchema>;

function buildCustomerSnapshot(
  input: NonNullable<AdminBookingUpdateInput["customer"]>,
  billTo: CashBillTo = "INDIVIDUAL"
): CashCustomerSnapshot {
  const isCompany = billTo === "COMPANY";
  return {
    name: isCompany ? input.name.trim() : formatCustomerName(input.title, input.name.trim()),
    phone: input.phone,
    email: input.email?.trim() || null,
    pan: input.pan?.trim().toUpperCase() || null,
    gstin: input.gstin?.trim() || null,
    address: input.address?.trim() || null,
    city: input.city?.trim() || null,
    state: input.state?.trim() || null,
    pincode: input.pincode?.trim() || null,
    billTo,
    contactPerson: input.contactPerson?.trim() || null,
  };
}

export type { AdminBookingUpdateInput };

export async function updateBookingAsAdmin(
  bookingId: string,
  input: AdminBookingUpdateInput,
  userId: string
) {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { flightBooking: true, hotelBooking: true, customer: true, payments: true },
  });
  if (!booking) throw new Error("Booking not found");

  if (booking.billingType === "CASH") {
    const nextAmount =
      input.totalAmount !== undefined ? Number(input.totalAmount) : Number(booking.totalAmount);
    const existingSnap = parseCashCustomerSnapshot(booking.metadata);
    const nextPan = input.customer?.pan ?? existingSnap?.pan;
    const cashError = validateCashBillAmountAndPan({
      billingType: "CASH",
      totalAmount: nextAmount,
      pan: nextPan,
    });
    if (cashError) throw new Error(cashError);
  }

  const bookingData: Record<string, unknown> = {
    lastEditedAt: new Date(),
    lastEditedById: userId,
  };
  if (input.pnr !== undefined) bookingData.pnr = input.pnr || null;
  if (input.internalNotes !== undefined) bookingData.internalNotes = input.internalNotes;

  if (input.customer) {
    const snapshot = buildCustomerSnapshot(input.customer);
    if (booking.billingType === "CASH") {
      const existingMeta =
        booking.metadata && typeof booking.metadata === "object"
          ? (booking.metadata as Record<string, unknown>)
          : {};
      const existingSnap = parseCashCustomerSnapshot(booking.metadata);
      const billTo = existingSnap?.billTo || "INDIVIDUAL";
      bookingData.metadata = { ...existingMeta, cashCustomer: buildCustomerSnapshot(input.customer, billTo) };
    } else {
      await updateExistingCustomerFromBooking(booking.customerId, {
        name: snapshot.name,
        phone: snapshot.phone,
        email: snapshot.email || undefined,
        pan: snapshot.pan || undefined,
        gstin: snapshot.gstin || undefined,
        address: snapshot.address || undefined,
        city: snapshot.city || undefined,
        state: snapshot.state || undefined,
        pincode: snapshot.pincode || undefined,
      });
    }
  }

  const markablePaidStatuses = ["PENDING", "FAILED", "ON_CREDIT", "PARTIAL"];
  const markingPaid =
    input.paymentStatus === "PAID" && markablePaidStatuses.includes(booking.paymentStatus);
  if (input.paymentStatus === "PAID" && !markingPaid) {
    throw new Error("Only unpaid or partially paid bookings can be marked as paid");
  }

  const flightData: Record<string, unknown> = {};
  const hasFlightItineraryUpdate =
    input.airline !== undefined ||
    input.segments !== undefined ||
    input.passengers !== undefined ||
    input.tripType !== undefined ||
    input.cabinClass !== undefined ||
    input.fareType !== undefined ||
    input.addonType !== undefined;

  if (booking.flightBooking) {
    const agency = await getAgencySettings();
    const agencyHasGst = Boolean(agency?.gstin?.trim());
    const agencyStateCode = getStateCodeFromGstin(agency?.gstin);

    const airline = input.airline ?? booking.flightBooking.airline;
    const segments = (input.segments ?? booking.flightBooking.segments) as unknown as FlightSegment[];
    const passengers = (input.passengers ?? booking.flightBooking.passengers) as unknown as FlightPassenger[];
    const tripType = input.tripType ?? booking.flightBooking.tripType;
    const cabinClass = input.cabinClass ?? booking.flightBooking.cabinClass;
    const fareType = input.fareType ?? booking.flightBooking.fareType;
    const invoiceTaxType = input.invoiceTaxType ?? booking.flightBooking.invoiceTaxType;
    const buyerGstin =
      input.buyerGstin !== undefined
        ? input.buyerGstin?.toUpperCase() || null
        : booking.flightBooking.buyerGstin;
    const baseFare = input.baseFare ?? Number(booking.flightBooking.baseFare || 0);
    const serviceCharge = input.serviceCharge ?? Number(booking.flightBooking.serviceCharge || 0);
    const discountAmount = input.discountAmount ?? Number(booking.flightBooking.discountAmount || 0);

    let totalAmount = input.totalAmount;
    if (agencyHasGst && (input.baseFare !== undefined || input.serviceCharge !== undefined || input.discountAmount !== undefined || input.invoiceTaxType !== undefined || input.buyerGstin !== undefined)) {
      const tax = calculateFlightGst({
        serviceCharge,
        agencyStateCode,
        buyerGstin,
        buyerState: booking.flightBooking.buyerState ?? booking.customer.state,
        invoiceTaxType,
      });
      totalAmount = calculateFlightInvoiceTotal(baseFare, serviceCharge, tax, discountAmount);
      const existingGateway = Number(booking.flightBooking.paymentGatewayCharge || 0);
      const gatewayApplied = applyCardGatewayCharge(
        totalAmount,
        input.paymentGatewayCharge && input.paymentGatewayCharge > 0 ? "Card" : existingGateway > 0 ? "Card" : null
      );
      totalAmount = gatewayApplied.totalAmount;
      flightData.paymentGatewayCharge = gatewayApplied.paymentGatewayCharge || null;
      flightData.cgstRate = tax.cgstRate;
      flightData.sgstRate = tax.sgstRate;
      flightData.igstRate = tax.igstRate;
      flightData.cgstAmount = tax.cgstAmount;
      flightData.sgstAmount = tax.sgstAmount;
      flightData.igstAmount = tax.igstAmount;
      flightData.buyerState = tax.buyerState;
      flightData.buyerStateCode = tax.buyerStateCode;
      flightData.placeOfSupply = tax.placeOfSupply;
      flightData.buyerGstin = buyerGstin;
      flightData.baseFare = baseFare;
      flightData.serviceCharge = serviceCharge;
      flightData.discountAmount = discountAmount || null;
      flightData.invoiceTaxType = invoiceTaxType;
      flightData.hsnSac = FLIGHT_SERVICE_HSN;
    } else {
      if (input.baseFare !== undefined) flightData.baseFare = input.baseFare;
      if (input.serviceCharge !== undefined) flightData.serviceCharge = input.serviceCharge;
      if (input.discountAmount !== undefined) flightData.discountAmount = input.discountAmount;
      if (input.invoiceTaxType !== undefined) flightData.invoiceTaxType = input.invoiceTaxType;
      if (input.buyerGstin !== undefined) flightData.buyerGstin = input.buyerGstin?.toUpperCase() || null;
    }

    if (totalAmount !== undefined) bookingData.totalAmount = totalAmount;

    if (input.invoiceNarration !== undefined) flightData.invoiceNarration = input.invoiceNarration;
    if (input.showPassengerName !== undefined) flightData.showPassengerName = input.showPassengerName;
    if (input.msmeNumber !== undefined) flightData.msmeNumber = input.msmeNumber || null;
    if (input.cancellationPolicy !== undefined) flightData.cancellationPolicy = input.cancellationPolicy || null;
    if (input.includeCancellationPolicy !== undefined) {
      flightData.includeCancellationPolicy = input.includeCancellationPolicy;
    }
    if (input.freqFlyerUpdatedToAirline !== undefined) {
      flightData.freqFlyerUpdatedToAirline = input.freqFlyerUpdatedToAirline;
    }
    if (input.specialAssistanceUpdatedToAirline !== undefined) {
      flightData.specialAssistanceUpdatedToAirline = input.specialAssistanceUpdatedToAirline;
    }
    if (input.showEticket !== undefined) flightData.showEticket = input.showEticket;
    if (input.checkInAssistance !== undefined) flightData.checkInAssistance = input.checkInAssistance;
    if (input.secondaryPnr !== undefined) flightData.secondaryPnr = input.secondaryPnr || null;
    if (input.addonType !== undefined) flightData.addonType = toDbAddonType(input.addonType);
    if (input.addonCustomLabel !== undefined) flightData.addonCustomLabel = input.addonCustomLabel || null;
    if (input.addonCustomValue !== undefined) flightData.addonCustomValue = input.addonCustomValue || null;
    if (input.fareType !== undefined) flightData.fareType = input.fareType;

    if (hasFlightItineraryUpdate) {
      const normalizedSegments = normalizeFlightSegments(segments.map((s) => ({ ...s, airline })));
      const airlineLogoUrl = getAirlineLogoUrl(airline) || undefined;
      Object.assign(
        flightData,
        flightFieldsWithDeparture({
          airline,
          airlineLogoUrl,
          segments: normalizedSegments,
          passengers,
          tripType,
          cabinClass,
          fareType,
          secondaryPnr: input.secondaryPnr ?? booking.flightBooking.secondaryPnr,
          showEticket: input.showEticket ?? booking.flightBooking.showEticket,
          showPassengerName: input.showPassengerName ?? booking.flightBooking.showPassengerName,
          checkInAssistance: input.checkInAssistance ?? booking.flightBooking.checkInAssistance,
        })
      );
    }
  }

  if (booking.hotelBooking) {
    const hotelData: Record<string, unknown> = {};
    const agency = await getAgencySettings();
    const agencyHasGst = Boolean(agency?.gstin?.trim());
    const agencyStateCode = getStateCodeFromGstin(agency?.gstin);
    const invoiceTaxType = input.invoiceTaxType ?? booking.hotelBooking.invoiceTaxType;
    const buyerGstin =
      input.buyerGstin !== undefined
        ? input.buyerGstin?.toUpperCase() || null
        : booking.hotelBooking.buyerGstin;
    const baseFare = input.baseFare ?? Number(booking.hotelBooking.baseFare || 0);
    const serviceCharge = input.serviceCharge ?? Number(booking.hotelBooking.serviceCharge || 0);
    const discountAmount = input.discountAmount ?? Number(booking.hotelBooking.discountAmount || 0);

    if (
      agencyHasGst &&
      (input.baseFare !== undefined ||
        input.serviceCharge !== undefined ||
        input.discountAmount !== undefined ||
        input.invoiceTaxType !== undefined ||
        input.buyerGstin !== undefined)
    ) {
      const tax = calculateFlightGst({
        serviceCharge,
        agencyStateCode,
        buyerGstin,
        buyerState: booking.hotelBooking.buyerState ?? booking.customer.state,
        invoiceTaxType,
      });
      bookingData.totalAmount = calculateFlightInvoiceTotal(
        baseFare,
        serviceCharge,
        tax,
        discountAmount
      );
      hotelData.cgstRate = tax.cgstRate;
      hotelData.sgstRate = tax.sgstRate;
      hotelData.igstRate = tax.igstRate;
      hotelData.cgstAmount = tax.cgstAmount;
      hotelData.sgstAmount = tax.sgstAmount;
      hotelData.igstAmount = tax.igstAmount;
      hotelData.buyerState = tax.buyerState;
      hotelData.buyerStateCode = tax.buyerStateCode;
      hotelData.placeOfSupply = tax.placeOfSupply;
      hotelData.buyerGstin = buyerGstin;
      hotelData.baseFare = baseFare;
      hotelData.serviceCharge = serviceCharge;
      hotelData.discountAmount = discountAmount || null;
      hotelData.invoiceTaxType = invoiceTaxType;
      hotelData.hsnSac = HOTEL_SERVICE_HSN;
    } else {
      if (input.baseFare !== undefined) hotelData.baseFare = input.baseFare;
      if (input.serviceCharge !== undefined) hotelData.serviceCharge = input.serviceCharge;
      if (input.discountAmount !== undefined) hotelData.discountAmount = input.discountAmount;
      if (input.invoiceTaxType !== undefined) hotelData.invoiceTaxType = input.invoiceTaxType;
      if (input.buyerGstin !== undefined) hotelData.buyerGstin = input.buyerGstin?.toUpperCase() || null;
    }

    if (input.invoiceNarration !== undefined) {
      hotelData.invoiceNarration = input.invoiceNarration || null;
    }
    if (input.msmeNumber !== undefined) {
      hotelData.msmeNumber = input.msmeNumber || null;
    }

    const hasHotelStayUpdate =
      input.propertyName !== undefined ||
      input.propertyAddress !== undefined ||
      input.checkIn !== undefined ||
      input.checkOut !== undefined ||
      input.roomType !== undefined ||
      input.guests !== undefined ||
      input.rooms !== undefined ||
      input.mealPlan !== undefined ||
      input.roomsCount !== undefined ||
      input.adultsCount !== undefined ||
      input.childrenCount !== undefined ||
      input.roomAmenities !== undefined ||
      input.inclusions !== undefined ||
      input.agentRemarks !== undefined ||
      input.confirmationNo !== undefined ||
      input.cancellationPolicy !== undefined ||
      input.includeCancellationPolicy !== undefined ||
      input.policies !== undefined ||
      input.city !== undefined ||
      input.propertyPhone !== undefined ||
      input.propertyEmail !== undefined ||
      input.checkInTime !== undefined ||
      input.checkOutTime !== undefined;

    if (hasHotelStayUpdate) {
      const propertyName = input.propertyName ?? booking.hotelBooking.propertyName;
      const propertyAddress = input.propertyAddress ?? booking.hotelBooking.propertyAddress;
      const city = input.city !== undefined ? input.city || null : booking.hotelBooking.city;
      const propertyPhone =
        input.propertyPhone !== undefined ? input.propertyPhone || null : booking.hotelBooking.propertyPhone;
      const propertyEmail =
        input.propertyEmail !== undefined ? input.propertyEmail || null : booking.hotelBooking.propertyEmail;
      const checkInTime = input.checkInTime ?? booking.hotelBooking.checkInTime;
      const checkOutTime = input.checkOutTime ?? booking.hotelBooking.checkOutTime;
      const checkIn =
        input.checkIn !== undefined ? new Date(input.checkIn) : booking.hotelBooking.checkIn;
      const checkOut =
        input.checkOut !== undefined ? new Date(input.checkOut) : booking.hotelBooking.checkOut;
      const nights = Math.max(differenceInDays(checkOut, checkIn), 1);

      const hotelProfile = await upsertHotelProfile({
        name: propertyName,
        address: propertyAddress,
        city: city || undefined,
        phone: propertyPhone || undefined,
        email: propertyEmail || undefined,
        checkInTime,
        checkOutTime,
      });

      const rooms = normalizeHotelRooms({
        rooms: input.rooms ?? booking.hotelBooking.rooms,
        roomsCount: input.roomsCount ?? booking.hotelBooking.roomsCount,
        adultsCount: input.adultsCount ?? booking.hotelBooking.adultsCount,
        childrenCount: input.childrenCount ?? booking.hotelBooking.childrenCount,
        guests:
          (input.guests as HotelGuest[] | undefined) ??
          (booking.hotelBooking.guests as unknown as HotelGuest[]),
      });
      const roomTotals = totalsFromHotelRooms(rooms);

      hotelData.hotelProfileId = hotelProfile.id;
      hotelData.propertyName = propertyName;
      hotelData.propertyAddress = propertyAddress;
      hotelData.city = city;
      hotelData.propertyPhone = propertyPhone;
      hotelData.propertyEmail = propertyEmail;
      hotelData.checkIn = checkIn;
      hotelData.checkOut = checkOut;
      hotelData.checkInTime = checkInTime || "02:00 PM";
      hotelData.checkOutTime = checkOutTime || "12:00 PM";
      hotelData.nights = nights;
      hotelData.roomType = input.roomType ?? booking.hotelBooking.roomType;
      hotelData.roomsCount = roomTotals.roomsCount;
      hotelData.mealPlan = input.mealPlan ?? booking.hotelBooking.mealPlan;
      hotelData.roomAmenities = input.roomAmenities ?? booking.hotelBooking.roomAmenities;
      hotelData.adultsCount = roomTotals.adultsCount;
      hotelData.childrenCount = roomTotals.childrenCount;
      hotelData.guests = roomTotals.guests;
      hotelData.rooms = rooms;
      hotelData.inclusions =
        input.inclusions !== undefined ? input.inclusions || null : booking.hotelBooking.inclusions;
      hotelData.cancellationPolicy =
        input.cancellationPolicy !== undefined
          ? input.cancellationPolicy || null
          : booking.hotelBooking.cancellationPolicy;
      hotelData.includeCancellationPolicy =
        input.includeCancellationPolicy ?? booking.hotelBooking.includeCancellationPolicy;
      hotelData.policies =
        input.policies !== undefined ? input.policies || null : booking.hotelBooking.policies;
      hotelData.agentRemarks =
        input.agentRemarks !== undefined
          ? input.agentRemarks || null
          : booking.hotelBooking.agentRemarks;
      hotelData.confirmationNo =
        input.confirmationNo !== undefined
          ? input.confirmationNo || null
          : input.pnr !== undefined
            ? input.pnr || null
            : booking.hotelBooking.confirmationNo;
    }

    if (Object.keys(hotelData).length > 0) {
      await prisma.hotelBooking.update({
        where: { bookingId },
        data: hotelData,
      });
    }
  }

  if (input.totalAmount !== undefined && bookingData.totalAmount === undefined) {
    bookingData.totalAmount = input.totalAmount;
  }

  await prisma.booking.update({
    where: { id: bookingId },
    data: bookingData,
  });

  if (booking.flightBooking && Object.keys(flightData).length > 0) {
    await prisma.flightBooking.update({
      where: { bookingId },
      data: flightData,
    });
  }

  if (markingPaid) {
    const totalAmount =
      input.totalAmount !== undefined
        ? input.totalAmount
        : bookingData.totalAmount !== undefined
          ? Number(bookingData.totalAmount)
          : Number(booking.totalAmount);
    const amountDue = computeAmountDue(totalAmount, sumPaidPayments(booking.payments));
    if (amountDue > 0) {
      await recordBookingPayment(
        bookingId,
        {
          amount: amountDue,
          method: input.paymentMethod!.trim() as RecordBookingPaymentInput["method"],
          note: "Marked as paid from booking edit",
        },
        userId
      );
    }
  }

  await logActivity({
    bookingId,
    userId,
    action: "BOOKING_EDITED",
    details: { ...input } as Prisma.InputJsonValue,
  });

  if (input.regenerateDocuments !== false) {
    await generateBookingDocuments(bookingId, userId);
  }

  if (booking.flightBooking && input.checkInAssistance) {
    await maybeSendImmediateCheckInAssistanceAlert(bookingId);
  }

  return prisma.booking.findUnique({
    where: { id: bookingId },
    include: { customer: true, flightBooking: true, hotelBooking: true, documents: true },
  });
}

export async function deleteBookingWithRenumber(bookingId: string, userId: string) {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { documents: true, customer: true },
  });
  if (!booking) throw new Error("Booking not found");

  let serialYear = booking.serialYear;
  let serialNumber = booking.serialNumber;
  if (serialYear == null || serialNumber == null) {
    const parsed = parsePublicRef(booking.publicRef);
    if (!parsed) throw new Error("Cannot parse booking serial from public ref");
    serialYear = parsed.year;
    serialNumber = parsed.serialNumber;
    await prisma.booking.update({
      where: { id: bookingId },
      data: { serialYear, serialNumber },
    });
  }

  const deletedRef = booking.publicRef;

  // Remove PDF files from disk
  for (const doc of booking.documents) {
    try {
      await fs.unlink(doc.storagePath);
    } catch {
      // file may already be missing
    }
  }

  const renumberedIds: string[] = [];

  await prisma.$transaction(async (tx) => {
    // Reverse credit if booking was on credit
    if (booking.paymentStatus === "ON_CREDIT") {
      const customer = await tx.customer.findUnique({ where: { id: booking.customerId } });
      if (customer) {
        const amount = Number(booking.totalAmount);
        const balanceAfter = Math.round((Number(customer.creditBalance) - amount) * 100) / 100;
        await tx.customer.update({
          where: { id: booking.customerId },
          data: { creditBalance: Math.max(0, balanceAfter) },
        });
        await tx.customerCreditTransaction.create({
          data: {
            customerId: booking.customerId,
            bookingId: booking.id,
            type: "REFUND",
            amount,
            balanceAfter: Math.max(0, balanceAfter),
            note: `Booking ${deletedRef} deleted`,
            createdById: userId,
          },
        });
      }
    }

    await tx.booking.delete({ where: { id: bookingId } });

    const later = await tx.booking.findMany({
      where: { serialYear, serialNumber: { gt: serialNumber } },
      orderBy: { serialNumber: "asc" },
      include: { documents: true },
    });

    for (const b of later) {
      const newNum = b.serialNumber! - 1;
      const newRef = formatPublicRef(serialYear, newNum);
      await tx.booking.update({
        where: { id: b.id },
        data: { serialNumber: newNum, publicRef: newRef },
      });
      renumberedIds.push(b.id);
    }

    // Keep serial counter aligned with highest remaining booking for this brand+year
    const maxRemaining = await tx.booking.aggregate({
      where: { brandId: booking.brandId, serialYear },
      _max: { serialNumber: true },
    });
    const lastNumber = maxRemaining._max.serialNumber ?? 0;
    await tx.bookingSerialCounter.upsert({
      where: { brandId_year: { brandId: booking.brandId, year: serialYear } },
      create: { brandId: booking.brandId, year: serialYear, lastNumber },
      update: { lastNumber },
    });
  });

  for (const id of renumberedIds) {
    await generateBookingDocuments(id, userId);
  }

  await logActivity({
    userId,
    action: "BOOKING_DELETED",
    details: { deletedRef, serialYear, serialNumber },
  });

  return { deletedRef, renumbered: renumberedIds.length };
}
