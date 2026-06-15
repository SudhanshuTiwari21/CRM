import { z } from "zod";

const gstinRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;

export const customerBranchSchema = z.object({
  name: z.string().min(1, "Branch name is required"),
  gstin: z
    .string()
    .optional()
    .or(z.literal(""))
    .refine((v) => !v || gstinRegex.test(v.toUpperCase()), "Invalid GSTIN format"),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  pincode: z.string().optional(),
  isPrimary: z.boolean().optional(),
});

export const customerContactSchema = z.object({
  name: z.string().min(1, "Contact name is required"),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  designation: z.string().optional(),
  isPrimary: z.boolean().optional(),
});

export const individualCustomerSchema = z.object({
  type: z.literal("INDIVIDUAL"),
  name: z.string().min(2),
  phone: z.string().min(10),
  email: z.string().email().optional().or(z.literal("")),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  pincode: z.string().optional(),
});

export const businessCustomerSchema = z.object({
  type: z.literal("BUSINESS"),
  name: z.string().min(2, "Business name is required"),
  phone: z.string().min(10),
  email: z.string().email().optional().or(z.literal("")),
  pan: z
    .string()
    .optional()
    .or(z.literal(""))
    .refine((v) => !v || panRegex.test(v.toUpperCase()), "Invalid PAN format"),
  branches: z.array(customerBranchSchema).optional(),
  contacts: z.array(customerContactSchema).min(1, "Add at least one contact"),
});

export const createCustomerSchema = z.discriminatedUnion("type", [
  individualCustomerSchema,
  businessCustomerSchema,
]);

export const updateCustomerSchema = z.union([
  individualCustomerSchema.extend({ branches: z.undefined().optional(), contacts: z.undefined().optional() }),
  businessCustomerSchema,
]);

export const gstinLookupSchema = z.object({
  gstin: z.string().regex(gstinRegex, "Invalid GSTIN format"),
});
