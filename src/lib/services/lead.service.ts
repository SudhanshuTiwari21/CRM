import { prisma } from "@/lib/db";
import type { LeadNoteType, LeadStatus, Prisma } from "@prisma/client";
import type { CreateLeadParsed, UpdateLeadInput } from "@/lib/validators/lead";
import { createCustomerRecord } from "@/lib/services/customer.service";

export const leadListInclude = {
  assignedAgent: { select: { id: true, name: true, email: true } },
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
};

function parseFollowUp(value?: string | null) {
  if (!value?.trim()) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

export async function listLeads(params: {
  search?: string;
  status?: LeadStatus | "ALL";
  assignedAgentId?: string | "ALL" | "UNASSIGNED";
  page?: number;
  limit?: number;
}) {
  const page = params.page || 1;
  const limit = params.limit || 20;
  const where: Prisma.LeadWhereInput = {};

  if (params.status && params.status !== "ALL") {
    where.status = params.status;
  }

  if (params.assignedAgentId === "UNASSIGNED") {
    where.assignedAgentId = null;
  } else if (params.assignedAgentId && params.assignedAgentId !== "ALL") {
    where.assignedAgentId = params.assignedAgentId;
  }

  if (params.search?.trim()) {
    const q = params.search.trim();
    where.OR = [
      { name: { contains: q, mode: "insensitive" } },
      { phone: { contains: q } },
      { email: { contains: q, mode: "insensitive" } },
      { company: { contains: q, mode: "insensitive" } },
      { requirement: { contains: q, mode: "insensitive" } },
    ];
  }

  const [leads, total, statusCounts] = await Promise.all([
    prisma.lead.findMany({
      where,
      include: leadListInclude,
      orderBy: [{ nextFollowUpAt: "asc" }, { createdAt: "desc" }],
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.lead.count({ where }),
    prisma.lead.groupBy({
      by: ["status"],
      _count: { _all: true },
    }),
  ]);

  return {
    leads,
    total,
    page,
    limit,
    statusCounts: Object.fromEntries(statusCounts.map((s) => [s.status, s._count._all])),
  };
}

export async function getLeadById(id: string) {
  return prisma.lead.findUnique({
    where: { id },
    include: leadDetailInclude,
  });
}

export async function createLead(input: CreateLeadParsed, userId: string) {
  const lead = await prisma.lead.create({
    data: {
      name: input.name.trim(),
      phone: input.phone?.trim() || null,
      email: input.email?.trim() || null,
      company: input.company?.trim() || null,
      source: input.source,
      status: input.status || "NEW",
      productInterest: input.productInterest || null,
      estimatedValue: input.estimatedValue ?? null,
      nextFollowUpAt: parseFollowUp(input.nextFollowUpAt),
      requirement: input.requirement?.trim() || null,
      assignedAgentId: input.assignedAgentId || null,
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
  if (input.productInterest !== undefined) data.productInterest = input.productInterest;
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

  const statusChanged = input.status !== undefined && input.status !== existing.status;
  if (input.status !== undefined) data.status = input.status;

  const lead = await prisma.$transaction(async (tx) => {
    const updated = await tx.lead.update({
      where: { id },
      data,
      include: leadDetailInclude,
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
          body: input.assignedAgentId
            ? `Assigned to agent`
            : "Unassigned",
          details: {
            fromAgentId: existing.assignedAgentId,
            toAgentId: input.assignedAgentId,
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

export async function addLeadNote(
  leadId: string,
  input: { body: string; type?: LeadNoteType },
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
    },
    include: { user: { select: { id: true, name: true } } },
  });
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
