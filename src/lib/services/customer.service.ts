import { prisma } from "@/lib/db";
import type { Prisma } from "@prisma/client";
import type { z } from "zod";
import type { createCustomerSchema } from "@/lib/validators/customer";
import { normalizePhone, phoneLookupVariants } from "@/lib/phone";
import { CASH_WALK_IN_PHONE } from "@/lib/cash-customer";
import { getActiveDbBrand } from "@/lib/brand-context";

type CreateCustomerInput = z.infer<typeof createCustomerSchema>;

export async function getOrCreateCashWalkInCustomer() {
  const brandId = await getActiveDbBrand();
  const existing = await prisma.customer.findFirst({
    where: { brandId, phone: CASH_WALK_IN_PHONE },
  });
  if (existing) return existing;

  return prisma.customer.create({
    data: {
      brandId,
      type: "INDIVIDUAL",
      name: "Cash Walk-in",
      phone: CASH_WALK_IN_PHONE,
      tags: ["SYSTEM_CASH"],
    },
  });
}

export async function findCustomerByPhone(phone: string) {
  const brandId = await getActiveDbBrand();
  const variants = phoneLookupVariants(phone);
  return prisma.customer.findFirst({
    where: { brandId, phone: { in: variants } },
  });
}

export async function updateExistingCustomerFromBooking(
  customerId: string,
  customer: {
    name: string;
    email?: string;
    phone: string;
    pan?: string;
    gstin?: string;
    address?: string;
    city?: string;
    state?: string;
    pincode?: string;
  }
) {
  const existing = await prisma.customer.findUnique({ where: { id: customerId } });
  if (!existing) throw new Error("Selected customer not found");

  const normalizedPhone = normalizePhone(customer.phone);
  if (normalizedPhone !== existing.phone) {
    const conflict = await findCustomerByPhone(customer.phone);
    if (conflict && conflict.id !== customerId) {
      throw new Error(
        `Another customer already uses this phone number (${conflict.name}).`
      );
    }
  }

  return prisma.customer.update({
    where: { id: customerId },
    data: {
      name: customer.name.trim(),
      phone: normalizedPhone,
      email: customer.email?.trim() || null,
      pan: customer.pan?.trim().toUpperCase() || null,
      gstin: customer.gstin?.trim() || null,
      address: customer.address?.trim() || null,
      city: customer.city?.trim() || null,
      state: customer.state?.trim() || null,
      pincode: customer.pincode?.trim() || null,
    },
  });
}

export async function createBusinessCustomerFromBooking(customer: {
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
}) {
  const normalizedPhone = normalizePhone(customer.phone);
  const existing = await findCustomerByPhone(customer.phone);
  if (existing) {
    throw new Error(
      `A customer with this phone number already exists (${existing.name}). Select them under "Select Customer".`
    );
  }

  const contactName = customer.contactPerson?.trim() || customer.name.trim();

  return createCustomerRecord({
    type: "BUSINESS",
    name: customer.name.trim(),
    phone: normalizedPhone,
    email: customer.email || "",
    pan: customer.pan || "",
    branches: [
      {
        name: "Head Office",
        gstin: customer.gstin || "",
        address: customer.address || "",
        city: customer.city || "",
        state: customer.state || "",
        pincode: customer.pincode || "",
        isPrimary: true,
      },
    ],
    contacts: [
      {
        name: contactName,
        phone: normalizedPhone,
        email: customer.email || "",
        designation: "",
        isPrimary: true,
      },
    ],
  });
}

export async function upsertCustomerFromBooking(customer: {
  name: string;
  email?: string;
  phone: string;
  pan?: string;
  gstin?: string;
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;
}) {
  const normalizedPhone = normalizePhone(customer.phone);
  const existing = await findCustomerByPhone(customer.phone);
  const pan = customer.pan?.toUpperCase() || null;

  if (existing) {
    return prisma.customer.update({
      where: { id: existing.id },
      data: {
        phone: normalizedPhone,
        name: customer.name,
        email: customer.email || existing.email,
        pan: pan || existing.pan,
        gstin: customer.gstin || existing.gstin,
        address: customer.address || existing.address,
        city: customer.city || existing.city,
        state: customer.state || existing.state,
        pincode: customer.pincode || existing.pincode,
      },
    });
  }

  return prisma.customer.create({
    data: {
      name: customer.name,
      phone: normalizedPhone,
      email: customer.email || null,
      pan,
      gstin: customer.gstin || null,
      address: customer.address || null,
      city: customer.city || null,
      state: customer.state || null,
      pincode: customer.pincode || null,
    },
  });
}

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

export async function createCustomerRecord(
  input: CreateCustomerInput,
  options?: { creditLimitAllowed?: boolean }
) {
  const normalizedPhone = normalizePhone(input.phone);
  const existing = await findCustomerByPhone(input.phone);
  if (existing) {
    throw new Error(
      `A customer with this phone number already exists (${existing.name}). Use the existing profile or update it.`
    );
  }

  const creditEnabled = input.creditEnabled ?? false;
  const creditLimit =
    options?.creditLimitAllowed && input.creditLimit != null ? input.creditLimit : null;
  const brandId = await getActiveDbBrand();

  if (input.type === "INDIVIDUAL") {
    return prisma.customer.create({
      data: {
        brandId,
        type: "INDIVIDUAL",
        name: input.name,
        phone: normalizedPhone,
        email: input.email || null,
        address: input.address || null,
        city: input.city || null,
        state: input.state || null,
        pincode: input.pincode || null,
        creditEnabled,
        creditLimit,
      },
      include: { branches: true, contacts: true },
    });
  }

  const primaryAddr = primaryBranchAddress(input.branches);

  return prisma.customer.create({
    data: {
      brandId,
      type: "BUSINESS",
      name: input.name,
      phone: normalizedPhone,
      email: input.email || null,
      pan: input.pan || null,
      creditEnabled,
      creditLimit,
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
  const normalizedPhone = normalizePhone(input.phone);
  const duplicate = await prisma.customer.findFirst({
    where: {
      phone: { in: phoneLookupVariants(input.phone) },
      NOT: { id },
    },
  });
  if (duplicate) {
    throw new Error(`Phone number is already used by ${duplicate.name}`);
  }

  if (input.type === "INDIVIDUAL") {
    await prisma.customerBranch.deleteMany({ where: { customerId: id } });
    await prisma.customerContact.deleteMany({ where: { customerId: id } });
    return prisma.customer.update({
      where: { id },
      data: {
        type: "INDIVIDUAL",
        name: input.name,
        phone: normalizedPhone,
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
      phone: normalizedPhone,
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
