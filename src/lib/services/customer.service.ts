import { prisma } from "@/lib/db";
import type { Prisma } from "@prisma/client";
import type { z } from "zod";
import type { createCustomerSchema } from "@/lib/validators/customer";

type CreateCustomerInput = z.infer<typeof createCustomerSchema>;

function primaryBranchAddress(
  branches?: Array<{
    gstin?: string;
    address?: string;
    city?: string;
    state?: string;
    pincode?: string;
    isPrimary?: boolean;
  }>
) {
  const primary = branches?.find((b) => b.isPrimary) || branches?.[0];
  if (!primary) return {};
  return {
    gstin: primary.gstin || null,
    address: primary.address || null,
    city: primary.city || null,
    state: primary.state || null,
    pincode: primary.pincode || null,
  };
}

export async function createCustomerRecord(input: CreateCustomerInput) {
  if (input.type === "INDIVIDUAL") {
    return prisma.customer.create({
      data: {
        type: "INDIVIDUAL",
        name: input.name,
        phone: input.phone,
        email: input.email || null,
        address: input.address || null,
        city: input.city || null,
        state: input.state || null,
        pincode: input.pincode || null,
      },
      include: { branches: true, contacts: true },
    });
  }

  const primaryAddr = primaryBranchAddress(input.branches);

  return prisma.customer.create({
    data: {
      type: "BUSINESS",
      name: input.name,
      phone: input.phone,
      email: input.email || null,
      pan: input.pan || null,
      ...primaryAddr,
      branches: {
        create: (input.branches || []).map((branch, index) => ({
          name: branch.name,
          gstin: branch.gstin || null,
          address: branch.address || null,
          city: branch.city || null,
          state: branch.state || null,
          pincode: branch.pincode || null,
          isPrimary: branch.isPrimary ?? index === 0,
        })),
      },
      contacts: {
        create: input.contacts.map((contact, index) => ({
          name: contact.name,
          phone: contact.phone || null,
          email: contact.email || null,
          designation: contact.designation || null,
          isPrimary: contact.isPrimary ?? index === 0,
        })),
      },
    },
    include: { branches: true, contacts: true },
  });
}

export async function updateCustomerRecord(
  id: string,
  input: CreateCustomerInput
) {
  if (input.type === "INDIVIDUAL") {
    await prisma.customerBranch.deleteMany({ where: { customerId: id } });
    await prisma.customerContact.deleteMany({ where: { customerId: id } });
    return prisma.customer.update({
      where: { id },
      data: {
        type: "INDIVIDUAL",
        name: input.name,
        phone: input.phone,
        email: input.email || null,
        address: input.address || null,
        city: input.city || null,
        state: input.state || null,
        pincode: input.pincode || null,
        pan: null,
        gstin: null,
      },
      include: { branches: true, contacts: true },
    });
  }

  const primaryAddr = primaryBranchAddress(input.branches);

  await prisma.customerBranch.deleteMany({ where: { customerId: id } });
  await prisma.customerContact.deleteMany({ where: { customerId: id } });

  return prisma.customer.update({
    where: { id },
    data: {
      type: "BUSINESS",
      name: input.name,
      phone: input.phone,
      email: input.email || null,
      pan: input.pan || null,
      ...primaryAddr,
      branches: {
        create: (input.branches || []).map((branch, index) => ({
          name: branch.name,
          gstin: branch.gstin || null,
          address: branch.address || null,
          city: branch.city || null,
          state: branch.state || null,
          pincode: branch.pincode || null,
          isPrimary: branch.isPrimary ?? index === 0,
        })),
      },
      contacts: {
        create: input.contacts.map((contact, index) => ({
          name: contact.name,
          phone: contact.phone || null,
          email: contact.email || null,
          designation: contact.designation || null,
          isPrimary: contact.isPrimary ?? index === 0,
        })),
      },
    },
    include: { branches: true, contacts: true },
  });
}

export async function getCustomerWithRelations(id: string) {
  return prisma.customer.findUnique({
    where: { id },
    include: {
      branches: { orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }] },
      contacts: { orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }] },
      bookings: {
        orderBy: { createdAt: "desc" },
        include: { assignedAgent: { select: { name: true } } },
      },
    },
  });
}

export function customerListInclude(): Prisma.CustomerInclude {
  return {
    _count: { select: { bookings: true } },
    branches: { where: { isPrimary: true }, take: 1 },
    contacts: { where: { isPrimary: true }, take: 1 },
    bookings: { select: { totalAmount: true, paymentStatus: true } },
  };
}
