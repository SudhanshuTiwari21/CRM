import { prisma } from "@/lib/db";
import type {
  LeadCallOutcome,
  LeadNoteType,
  LeadStatus,
  LeadTemperature,
  LeadServiceType,
  Prisma,
} from "@prisma/client";
import type { CreateLeadParsed, CreateLeadTaskParsed, LeadProgressFilter, UpdateLeadInput } from "@/lib/validators/lead";
import { createCustomerRecord } from "@/lib/services/customer.service";
import { allocateQueryRef } from "@/lib/lead-ref";
import { subDays, startOfDay, endOfDay } from "date-fns";
import {
  LEAD_CALL_DIRECTION_LABELS,
  LEAD_CALL_OUTCOME_LABELS,
  LEAD_TASK_TYPE_LABELS,
} from "@/lib/constants/lead";

export const leadListInclude = {
  assignedAgent: { select: { id: true, name: true, email: true } },
  assignedOps: { select: { id: true, name: true, email: true } },
  createdBy: { select: { id: true, name: true } },
  customer: { select: { id: true, name: true, phone: true } },
  booking: { select: { id: true, publicRef: true } },
  _count: { select: { notes: true } },
} satisfies Prisma.LeadInclude;

export const leadDetailInclude = {
  ...leadListInclude,
  notes: {
    orderBy: { createdAt: "desc" as const },
    include: { user: { select: { id: true, name: true } } },
  },
  tasks: {
    orderBy: { createdAt: "desc" as const },
    include: {
      assignedTo: { select: { id: true, name: true } },
      createdBy: { select: { id: true, name: true } },
    },
  },
};

function parseDate(value?: string | null) {
  if (!value?.trim()) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function parseFollowUp(value?: string | null) {
  return parseDate(value);
}

function applyProgressFilter(
  progress: LeadProgressFilter | undefined,
  where: Prisma.LeadWhereInput
) {
  if (!progress || progress === "OVERALL") return;

  switch (progress) {
    case "IN_PROGRESS":
      where.status = { in: ["NEW", "CONTACTED", "QUALIFIED", "PROPOSAL"] };
      break;
    case "RECENT":
      where.createdAt = { gte: subDays(new Date(), 7) };
      break;
    case "CONFIRMED":
      where.status = "QUALIFIED";
      break;
    case "CONVERTED":
      where.status = "WON";
      break;
    case "LOST":
      where.status = "LOST";
      break;
  }
}

export async function listLeads(params: {
  search?: string;
  status?: LeadStatus | "ALL";
  temperature?: LeadTemperature | "ALL";
  progress?: LeadProgressFilter;
  serviceType?: LeadServiceType | "ALL";
  assignedAgentId?: string | "ALL" | "UNASSIGNED" | "ME";
  assignedOpsId?: string | "ALL" | "UNASSIGNED";
  currentUserId?: string;
  page?: number;
  limit?: number;
}) {
  const page = params.page || 1;
  const limit = params.limit || 20;
  const where: Prisma.LeadWhereInput = {};

  applyProgressFilter(params.progress, where);

  if (params.status && params.status !== "ALL") {
    where.status = params.status;
  }

  if (params.temperature && params.temperature !== "ALL") {
    where.temperature = params.temperature;
  }

  if (params.serviceType && params.serviceType !== "ALL") {
    where.serviceType = params.serviceType;
  }

  if (params.assignedAgentId === "UNASSIGNED") {
    where.assignedAgentId = null;
  } else if (params.assignedAgentId === "ME" && params.currentUserId) {
    where.assignedAgentId = params.currentUserId;
  } else if (params.assignedAgentId && params.assignedAgentId !== "ALL") {
    where.assignedAgentId = params.assignedAgentId;
  }

  if (params.assignedOpsId === "UNASSIGNED") {
    where.assignedOpsId = null;
  } else if (params.assignedOpsId && params.assignedOpsId !== "ALL") {
    where.assignedOpsId = params.assignedOpsId;
  }

  if (params.search?.trim()) {
    const q = params.search.trim();
    where.OR = [
      { name: { contains: q, mode: "insensitive" } },
      { phone: { contains: q } },
      { email: { contains: q, mode: "insensitive" } },
      { company: { contains: q, mode: "insensitive" } },
      { requirement: { contains: q, mode: "insensitive" } },
      { destinations: { contains: q, mode: "insensitive" } },
      { queryRef: { contains: q, mode: "insensitive" } },
    ];
  }

  const [leads, total, statusCounts, temperatureCounts, progressCounts] = await Promise.all([
    prisma.lead.findMany({
      where,
      include: leadListInclude,
      orderBy: [{ createdAt: "desc" }],
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.lead.count({ where }),
    prisma.lead.groupBy({
      by: ["status"],
      _count: { _all: true },
    }),
    prisma.lead.groupBy({
      by: ["temperature"],
      _count: { _all: true },
    }),
    Promise.all([
      prisma.lead.count({
        where: { status: { in: ["NEW", "CONTACTED", "QUALIFIED", "PROPOSAL"] } },
      }),
      prisma.lead.count({ where: { createdAt: { gte: subDays(new Date(), 7) } } }),
      prisma.lead.count({ where: { status: "QUALIFIED" } }),
      prisma.lead.count({ where: { status: "WON" } }),
      prisma.lead.count({ where: { status: "LOST" } }),
      prisma.lead.count(),
    ]),
  ]);

  const [inProgress, recent, confirmed, converted, lost, overall] = progressCounts;

  return {
    leads,
    total,
    page,
    limit,
    statusCounts: Object.fromEntries(statusCounts.map((s) => [s.status, s._count._all])),
    temperatureCounts: Object.fromEntries(
      temperatureCounts.map((t) => [t.temperature, t._count._all])
    ),
    progressCounts: {
      IN_PROGRESS: inProgress,
      RECENT: recent,
      CONFIRMED: confirmed,
      CONVERTED: converted,
      LOST: lost,
      OVERALL: overall,
    },
  };
}

export async function getLeadById(id: string) {
  return prisma.lead.findUnique({
    where: { id },
    include: leadDetailInclude,
  });
}

export async function createLead(input: CreateLeadParsed, userId: string) {
  const lead = await prisma.$transaction(async (tx) => {
    const ref = await allocateQueryRef(tx);

    return tx.lead.create({
      data: {
        ...ref,
        name: input.name.trim(),
        phone: input.phone?.trim() || null,
        email: input.email?.trim() || null,
        company: input.company?.trim() || null,
        source: input.source,
        status: input.status || "NEW",
        temperature: input.temperature || "NONE",
        serviceType: input.serviceType || null,
        customerSegment: input.customerSegment || "B2C",
        productInterest: input.productInterest || null,
        travelDate: parseDate(input.travelDate),
        returnDate: parseDate(input.returnDate),
        destinations: input.destinations?.trim() || null,
        adultCount: input.adultCount ?? null,
        childCount: input.childCount ?? null,
        infantCount: input.infantCount ?? null,
        estimatedValue: input.estimatedValue ?? null,
        nextFollowUpAt: parseFollowUp(input.nextFollowUpAt),
        requirement: input.requirement?.trim() || null,
        assignedAgentId: input.assignedAgentId || null,
        assignedOpsId: input.assignedOpsId || null,
        createdById: userId,
        notes: input.note?.trim()
          ? {
              create: {
                body: input.note.trim(),
                type: "NOTE",
                userId,
              },
            }
          : undefined,
      },
      include: leadDetailInclude,
    });
  });

  return lead;
}

export async function updateLead(id: string, input: UpdateLeadInput, userId: string) {
  const existing = await prisma.lead.findUnique({ where: { id } });
  if (!existing) throw new Error("Lead not found");

  const data: Prisma.LeadUpdateInput = {};
  if (input.name !== undefined) data.name = input.name.trim();
  if (input.phone !== undefined) data.phone = input.phone?.trim() || null;
  if (input.email !== undefined) data.email = input.email?.trim() || null;
  if (input.company !== undefined) data.company = input.company?.trim() || null;
  if (input.source !== undefined) data.source = input.source;
  if (input.temperature !== undefined) data.temperature = input.temperature;
  if (input.serviceType !== undefined) data.serviceType = input.serviceType;
  if (input.customerSegment !== undefined) data.customerSegment = input.customerSegment;
  if (input.productInterest !== undefined) data.productInterest = input.productInterest;
  if (input.travelDate !== undefined) data.travelDate = parseDate(input.travelDate);
  if (input.returnDate !== undefined) data.returnDate = parseDate(input.returnDate);
  if (input.destinations !== undefined) data.destinations = input.destinations?.trim() || null;
  if (input.adultCount !== undefined) data.adultCount = input.adultCount;
  if (input.childCount !== undefined) data.childCount = input.childCount;
  if (input.infantCount !== undefined) data.infantCount = input.infantCount;
  if (input.estimatedValue !== undefined) data.estimatedValue = input.estimatedValue;
  if (input.nextFollowUpAt !== undefined) data.nextFollowUpAt = parseFollowUp(input.nextFollowUpAt);
  if (input.requirement !== undefined) data.requirement = input.requirement?.trim() || null;
  if (input.lostReason !== undefined) data.lostReason = input.lostReason?.trim() || null;
  if (input.customerId !== undefined) {
    data.customer = input.customerId ? { connect: { id: input.customerId } } : { disconnect: true };
  }
  if (input.bookingId !== undefined) {
    data.booking = input.bookingId ? { connect: { id: input.bookingId } } : { disconnect: true };
  }
  if (input.assignedAgentId !== undefined) {
    data.assignedAgent = input.assignedAgentId
      ? { connect: { id: input.assignedAgentId } }
      : { disconnect: true };
  }
  if (input.assignedOpsId !== undefined) {
    data.assignedOps = input.assignedOpsId
      ? { connect: { id: input.assignedOpsId } }
      : { disconnect: true };
  }

  const statusChanged = input.status !== undefined && input.status !== existing.status;
  if (input.status !== undefined) data.status = input.status;

  const lead = await prisma.$transaction(async (tx) => {
    await tx.lead.update({
      where: { id },
      data,
    });

    if (statusChanged && input.status) {
      await tx.leadNote.create({
        data: {
          leadId: id,
          userId,
          type: "STATUS_CHANGE",
          body: `Status changed from ${existing.status} to ${input.status}`,
          details: { fromStatus: existing.status, toStatus: input.status },
        },
      });
    }

    if (
      input.assignedAgentId !== undefined &&
      input.assignedAgentId !== existing.assignedAgentId
    ) {
      await tx.leadNote.create({
        data: {
          leadId: id,
          userId,
          type: "ASSIGNMENT",
          body: input.assignedAgentId ? "Assigned to sales agent" : "Sales agent unassigned",
          details: {
            fromAgentId: existing.assignedAgentId,
            toAgentId: input.assignedAgentId,
            role: "sales",
          },
        },
      });
    }

    if (input.assignedOpsId !== undefined && input.assignedOpsId !== existing.assignedOpsId) {
      await tx.leadNote.create({
        data: {
          leadId: id,
          userId,
          type: "ASSIGNMENT",
          body: input.assignedOpsId ? "Assigned to ops user" : "Ops user unassigned",
          details: {
            fromAgentId: existing.assignedOpsId,
            toAgentId: input.assignedOpsId,
            role: "ops",
          },
        },
      });
    }

    return tx.lead.findUniqueOrThrow({
      where: { id },
      include: leadDetailInclude,
    });
  });

  return lead;
}

export async function bulkAssignLeads(
  leadIds: string[],
  input: { assignedAgentId?: string | null; assignedOpsId?: string | null },
  userId: string
) {
  const results = [];
  for (const leadId of leadIds) {
    const updated = await updateLead(
      leadId,
      {
        ...(input.assignedAgentId !== undefined ? { assignedAgentId: input.assignedAgentId } : {}),
        ...(input.assignedOpsId !== undefined ? { assignedOpsId: input.assignedOpsId } : {}),
      },
      userId
    );
    results.push(updated);
  }
  return { updated: results.length, leads: results };
}

export async function addLeadNote(
  leadId: string,
  input: { body: string; type?: LeadNoteType; details?: Prisma.InputJsonValue },
  userId: string
) {
  const lead = await prisma.lead.findUnique({ where: { id: leadId } });
  if (!lead) throw new Error("Lead not found");

  return prisma.leadNote.create({
    data: {
      leadId,
      userId,
      type: input.type || "NOTE",
      body: input.body.trim(),
      details: input.details,
    },
    include: { user: { select: { id: true, name: true } } },
  });
}

function buildTaskNoteBody(input: CreateLeadTaskParsed) {
  const parts: string[] = [];
  parts.push(LEAD_TASK_TYPE_LABELS[input.type]);
  if (input.type === "CALL" && input.direction) {
    parts.push(LEAD_CALL_DIRECTION_LABELS[input.direction]);
  }
  if (input.outcome) {
    parts.push(LEAD_CALL_OUTCOME_LABELS[input.outcome]);
  }
  if (input.isCompleted) parts.push("(Completed)");
  if (input.details?.trim()) parts.push(`— ${input.details.trim()}`);
  return parts.join(" · ");
}

export async function createLeadTask(leadId: string, input: CreateLeadTaskParsed, userId: string) {
  const lead = await prisma.lead.findUnique({ where: { id: leadId } });
  if (!lead) throw new Error("Lead not found");

  const scheduledAt = parseDate(input.scheduledAt);
  const now = new Date();

  return prisma.$transaction(async (tx) => {
    const task = await tx.leadTask.create({
      data: {
        leadId,
        type: input.type,
        direction: input.type === "CALL" ? input.direction || "OUTGOING" : null,
        outcome: input.type === "CALL" ? input.outcome || null : null,
        scheduledAt,
        completedAt: input.isCompleted ? now : null,
        isCompleted: input.isCompleted,
        details: input.details?.trim() || null,
        temperature: input.temperature || null,
        assignedToId: input.assignedToId || userId,
        createdById: userId,
      },
      include: {
        assignedTo: { select: { id: true, name: true } },
        createdBy: { select: { id: true, name: true } },
      },
    });

    const leadUpdate: Prisma.LeadUpdateInput = {};
    if (input.temperature !== undefined) leadUpdate.temperature = input.temperature;
    if (!input.isCompleted && scheduledAt) leadUpdate.nextFollowUpAt = scheduledAt;
    if (input.isCompleted) leadUpdate.nextFollowUpAt = null;

    if (input.outcome === "LOST") {
      leadUpdate.status = "LOST";
      if (input.details?.trim()) leadUpdate.lostReason = input.details.trim();
    } else if (input.type === "CALL" && input.outcome === "CALLBACK" && !input.isCompleted) {
      if (lead.status === "NEW") leadUpdate.status = "CONTACTED";
    }

    if (Object.keys(leadUpdate).length > 0) {
      await tx.lead.update({ where: { id: leadId }, data: leadUpdate });
    }

    await tx.leadNote.create({
      data: {
        leadId,
        userId,
        type: input.type === "CALL" ? "CALL" : "NOTE",
        body: buildTaskNoteBody(input),
        details: {
          taskId: task.id,
          type: input.type,
          direction: input.direction,
          outcome: input.outcome,
          scheduledAt: scheduledAt?.toISOString(),
          isCompleted: input.isCompleted,
          temperature: input.temperature,
        },
      },
    });

    return task;
  });
}

export async function getLeadFollowUpSummary(limit = 8) {
  const now = new Date();
  const todayStart = startOfDay(now);
  const todayEnd = endOfDay(now);

  const activeStatuses: LeadStatus[] = ["NEW", "CONTACTED", "QUALIFIED", "PROPOSAL"];

  const [overdue, dueToday, upcoming, overdueCount, dueTodayCount] = await Promise.all([
    prisma.lead.findMany({
      where: {
        status: { in: activeStatuses },
        nextFollowUpAt: { lt: todayStart },
      },
      include: leadListInclude,
      orderBy: { nextFollowUpAt: "asc" },
      take: limit,
    }),
    prisma.lead.findMany({
      where: {
        status: { in: activeStatuses },
        nextFollowUpAt: { gte: todayStart, lte: todayEnd },
      },
      include: leadListInclude,
      orderBy: { nextFollowUpAt: "asc" },
      take: limit,
    }),
    prisma.lead.findMany({
      where: {
        status: { in: activeStatuses },
        nextFollowUpAt: { gt: todayEnd },
      },
      include: leadListInclude,
      orderBy: { nextFollowUpAt: "asc" },
      take: limit,
    }),
    prisma.lead.count({
      where: {
        status: { in: activeStatuses },
        nextFollowUpAt: { lt: todayStart },
      },
    }),
    prisma.lead.count({
      where: {
        status: { in: activeStatuses },
        nextFollowUpAt: { gte: todayStart, lte: todayEnd },
      },
    }),
  ]);

  return { overdue, dueToday, upcoming, overdueCount, dueTodayCount };
}

export async function assignLead(leadId: string, assignedAgentId: string | null, userId: string) {
  return updateLead(leadId, { assignedAgentId }, userId);
}

export async function convertLeadToCustomer(
  leadId: string,
  opts: { createCustomer?: boolean; customerType?: "INDIVIDUAL" | "BUSINESS" },
  userId: string
) {
  const lead = await prisma.lead.findUnique({ where: { id: leadId } });
  if (!lead) throw new Error("Lead not found");
  if (!lead.phone?.trim()) throw new Error("Lead phone is required to convert to customer");

  let customerId = lead.customerId;

  if (!customerId && opts.createCustomer !== false) {
    const existing = await prisma.customer.findFirst({
      where: { phone: lead.phone },
    });
    if (existing) {
      customerId = existing.id;
    } else {
      const customer = await createCustomerRecord({
        type: "INDIVIDUAL",
        name: (lead.company?.trim() || lead.name).trim(),
        phone: lead.phone,
        email: lead.email || "",
      });
      customerId = customer.id;
    }
  }

  if (!customerId) throw new Error("Could not link customer");

  const updated = await updateLead(
    leadId,
    {
      customerId,
      status: "WON",
    },
    userId
  );

  return { ...updated, customerId };
}

export async function deleteLead(id: string) {
  const lead = await prisma.lead.findUnique({ where: { id } });
  if (!lead) throw new Error("Lead not found");
  await prisma.lead.delete({ where: { id } });
  return { deleted: true };
}
