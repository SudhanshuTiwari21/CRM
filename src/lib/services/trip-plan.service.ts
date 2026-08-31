import { prisma } from "@/lib/db";
import { getActiveDbBrand } from "@/lib/brand-context";
import type { Prisma } from "@prisma/client";
import type { CreateTripPlanInput, TripPlanItemInput, UpdateTripPlanInput } from "@/lib/validators/trip-plan";
import { DEFAULT_TRIP_TERMS } from "@/lib/constants/trip-plan";
import { computeItemSellPrice, computeTripTotals } from "@/lib/trip-plan-costing";

export const tripPlanInclude = {
  lead: {
    select: {
      id: true,
      name: true,
      queryRef: true,
      phone: true,
      email: true,
      destinations: true,
      travelDate: true,
      returnDate: true,
      adultCount: true,
      childCount: true,
      infantCount: true,
    },
  },
  createdBy: { select: { id: true, name: true } },
  items: { orderBy: [{ dayNumber: "asc" as const }, { sortOrder: "asc" as const }] },
} satisfies Prisma.TripPlanInclude;

function parseDate(value?: string | null) {
  if (!value?.trim()) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function normalizeItems(items: TripPlanItemInput[]) {
  return items.map((item, index) => {
    const costPrice = item.costPrice ?? 0;
    const quantity = item.quantity ?? 1;
    const markupType = item.markupType ?? "FIXED";
    const markupValue = item.markupValue ?? 0;
    const sellPrice =
      item.sellPrice != null
        ? item.sellPrice
        : computeItemSellPrice(costPrice, quantity, markupType, markupValue);

    return {
      dayNumber: item.dayNumber ?? 1,
      sortOrder: item.sortOrder ?? index,
      serviceType: item.serviceType,
      title: item.title.trim(),
      description: item.description?.trim() || null,
      supplierName: item.supplierName?.trim() || null,
      location: item.location?.trim() || null,
      serviceDate: parseDate(item.serviceDate),
      quantity,
      costPrice,
      markupType,
      markupValue,
      sellPrice,
    };
  });
}

function computeTotals(
  items: ReturnType<typeof normalizeItems>,
  gstRate?: number | null,
  offerPriceOverride?: number | null
) {
  return computeTripTotals(items, gstRate, offerPriceOverride);
}

async function assertLeadAccess(leadId: string) {
  const brandId = await getActiveDbBrand();
  const lead = await prisma.lead.findFirst({ where: { id: leadId, brandId } });
  if (!lead) throw new Error("Lead not found");
  return lead;
}

async function assertTripPlanAccess(id: string) {
  const brandId = await getActiveDbBrand();
  const plan = await prisma.tripPlan.findFirst({
    where: { id, brandId },
    include: tripPlanInclude,
  });
  if (!plan) throw new Error("Trip plan not found");
  return plan;
}

export async function listTripPlansForLead(leadId: string) {
  await assertLeadAccess(leadId);
  return prisma.tripPlan.findMany({
    where: { leadId },
    include: {
      createdBy: { select: { id: true, name: true } },
      _count: { select: { items: true } },
    },
    orderBy: { version: "desc" },
  });
}

export async function getLatestTripPlanForLead(leadId: string) {
  return prisma.tripPlan.findFirst({
    where: { leadId },
    orderBy: { version: "desc" },
    select: {
      id: true,
      version: true,
      status: true,
      title: true,
      offerPrice: true,
      currency: true,
    },
  });
}

export async function getTripPlanById(id: string) {
  return assertTripPlanAccess(id);
}

export async function createTripPlan(leadId: string, input: CreateTripPlanInput, userId: string) {
  const lead = await assertLeadAccess(leadId);
  const brandId = await getActiveDbBrand();

  const latest = await prisma.tripPlan.findFirst({
    where: { leadId },
    orderBy: { version: "desc" },
    select: { version: true },
  });
  const version = (latest?.version ?? 0) + 1;

  const items = normalizeItems(input.items || []);
  const totals = computeTotals(items, input.gstRate, input.offerPrice);

  const plan = await prisma.$transaction(async (tx) => {
    if (latest) {
      await tx.tripPlan.updateMany({
        where: { leadId, status: { in: ["DRAFT", "SENT"] } },
        data: { status: "SUPERSEDED" },
      });
    }

    const created = await tx.tripPlan.create({
      data: {
        brandId,
        leadId,
        version,
        title: input.title.trim(),
        travelDate: parseDate(input.travelDate) ?? lead.travelDate,
        returnDate: parseDate(input.returnDate) ?? lead.returnDate,
        destinations: input.destinations?.trim() || lead.destinations,
        adultCount: input.adultCount ?? lead.adultCount,
        childCount: input.childCount ?? lead.childCount,
        infantCount: input.infantCount ?? lead.infantCount,
        durationDays: input.durationDays ?? null,
        currency: input.currency || "INR",
        subtotalCost: totals.subtotalCost,
        subtotalSell: totals.subtotalSell,
        offerPrice: totals.offerPrice,
        gstRate: input.gstRate ?? null,
        gstAmount: totals.gstAmount,
        inclusions: input.inclusions?.trim() || null,
        exclusions: input.exclusions?.trim() || null,
        terms: input.terms?.trim() || DEFAULT_TRIP_TERMS,
        internalNotes: input.internalNotes?.trim() || null,
        createdById: userId,
        items: { create: items },
      },
      include: tripPlanInclude,
    });

    await tx.lead.update({
      where: { id: leadId },
      data: {
        estimatedValue: totals.offerPrice,
        status: lead.status === "NEW" || lead.status === "CONTACTED" ? "QUALIFIED" : lead.status,
      },
    });

    return created;
  });

  return plan;
}

export async function updateTripPlan(id: string, input: UpdateTripPlanInput, userId?: string) {
  const existing = await assertTripPlanAccess(id);
  const items = input.items ? normalizeItems(input.items) : null;
  const gstRate = input.gstRate !== undefined ? input.gstRate : Number(existing.gstRate);
  const offerOverride =
    input.offerPrice !== undefined && input.offerPrice != null
      ? input.offerPrice
      : Number(existing.offerPrice);

  const totals = items
    ? computeTotals(items, gstRate, offerOverride)
    : {
        subtotalCost: Number(existing.subtotalCost),
        subtotalSell: Number(existing.subtotalSell),
        gstAmount: existing.gstAmount != null ? Number(existing.gstAmount) : null,
        offerPrice: offerOverride,
      };

  const finalOfferPrice = totals.offerPrice ?? Number(existing.offerPrice);

  const sentAt =
    input.status === "SENT" && existing.status !== "SENT" ? new Date() : existing.sentAt;

  const plan = await prisma.$transaction(async (tx) => {
    if (items) {
      await tx.tripPlanItem.deleteMany({ where: { tripPlanId: id } });
    }

    const updated = await tx.tripPlan.update({
      where: { id },
      data: {
        title: input.title?.trim(),
        status: input.status,
        travelDate: input.travelDate !== undefined ? parseDate(input.travelDate) : undefined,
        returnDate: input.returnDate !== undefined ? parseDate(input.returnDate) : undefined,
        destinations: input.destinations !== undefined ? input.destinations?.trim() || null : undefined,
        adultCount: input.adultCount !== undefined ? input.adultCount : undefined,
        childCount: input.childCount !== undefined ? input.childCount : undefined,
        infantCount: input.infantCount !== undefined ? input.infantCount : undefined,
        durationDays: input.durationDays !== undefined ? input.durationDays : undefined,
        currency: input.currency,
        subtotalCost: totals.subtotalCost,
        subtotalSell: totals.subtotalSell,
        offerPrice: finalOfferPrice,
        gstRate: input.gstRate !== undefined ? input.gstRate ?? null : undefined,
        gstAmount: totals.gstAmount ?? null,
        inclusions: input.inclusions !== undefined ? input.inclusions?.trim() || null : undefined,
        exclusions: input.exclusions !== undefined ? input.exclusions?.trim() || null : undefined,
        terms: input.terms !== undefined ? input.terms?.trim() || null : undefined,
        internalNotes: input.internalNotes !== undefined ? input.internalNotes?.trim() || null : undefined,
        sentAt,
        ...(items ? { items: { create: items } } : {}),
      },
      include: tripPlanInclude,
    });

    if (input.status === "SENT") {
      await tx.lead.update({
        where: { id: existing.leadId },
        data: { status: "PROPOSAL", estimatedValue: finalOfferPrice },
      });

      await tx.leadNote.create({
        data: {
          leadId: existing.leadId,
          userId,
          type: "STATUS_CHANGE",
          body: `Trip proposal V${updated.version} sent (Rs. ${finalOfferPrice.toLocaleString("en-IN")})`,
        },
      });
    }

    if (input.status === "ACCEPTED") {
      await tx.lead.update({
        where: { id: existing.leadId },
        data: { status: "QUALIFIED", estimatedValue: finalOfferPrice },
      });
    }

    return updated;
  });

  return plan;
}

export async function duplicateTripPlan(id: string, userId: string) {
  const existing = await assertTripPlanAccess(id);

  return createTripPlan(
    existing.leadId,
    {
      title: existing.title,
      travelDate: existing.travelDate?.toISOString() || null,
      returnDate: existing.returnDate?.toISOString() || null,
      destinations: existing.destinations,
      adultCount: existing.adultCount,
      childCount: existing.childCount,
      infantCount: existing.infantCount,
      durationDays: existing.durationDays,
      currency: existing.currency,
      gstRate: existing.gstRate != null ? Number(existing.gstRate) : null,
      inclusions: existing.inclusions,
      exclusions: existing.exclusions,
      terms: existing.terms,
      internalNotes: existing.internalNotes,
      items: existing.items.map((item) => ({
        dayNumber: item.dayNumber,
        sortOrder: item.sortOrder,
        serviceType: item.serviceType,
        title: item.title,
        description: item.description,
        supplierName: item.supplierName,
        location: item.location,
        serviceDate: item.serviceDate?.toISOString() || null,
        quantity: item.quantity,
        costPrice: Number(item.costPrice),
        markupType: item.markupType,
        markupValue: Number(item.markupValue),
        sellPrice: Number(item.sellPrice),
      })),
    },
    userId
  );
}

export async function deleteTripPlan(id: string) {
  await assertTripPlanAccess(id);
  await prisma.tripPlan.delete({ where: { id } });
  return { ok: true };
}
