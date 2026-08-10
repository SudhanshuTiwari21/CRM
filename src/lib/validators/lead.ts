import { z } from "zod";
import { isValidIndianMobile, normalizePhone } from "@/lib/phone";

const optionalPhoneSchema = z
  .string()
  .optional()
  .or(z.literal(""))
  .transform((v) => (v?.trim() ? normalizePhone(v) : ""))
  .refine((v) => !v || isValidIndianMobile(v), "Enter a valid 10-digit Indian mobile number");

export const createLeadSchema = z.object({
  name: z.string().min(2, "Name is required"),
  phone: optionalPhoneSchema,
  email: z.string().email().optional().or(z.literal("")),
  company: z.string().optional(),
  source: z.enum(["PHONE", "WHATSAPP", "EMAIL", "WALK_IN", "REFERRAL", "WEBSITE", "OTHER"]).default("OTHER"),
  status: z.enum(["NEW", "CONTACTED", "QUALIFIED", "PROPOSAL", "WON", "LOST"]).optional(),
  productInterest: z.enum(["FLIGHT", "HOTEL", "BUS"]).optional().nullable(),
  estimatedValue: z.coerce.number().min(0).optional().nullable(),
  nextFollowUpAt: z.string().optional().nullable(),
  requirement: z.string().optional(),
  assignedAgentId: z.string().optional().nullable(),
  note: z.string().optional(),
});

export const updateLeadSchema = createLeadSchema.partial().extend({
  lostReason: z.string().optional().nullable(),
  customerId: z.string().optional().nullable(),
  bookingId: z.string().optional().nullable(),
});

export const leadNoteSchema = z.object({
  body: z.string().min(1, "Note is required"),
  type: z.enum(["NOTE", "CALL", "EMAIL", "WHATSAPP", "STATUS_CHANGE", "ASSIGNMENT"]).default("NOTE"),
});

export const assignLeadSchema = z.object({
  assignedAgentId: z.string().nullable(),
});

export const convertLeadSchema = z.object({
  createCustomer: z.boolean().default(true),
  customerType: z.enum(["INDIVIDUAL", "BUSINESS"]).default("INDIVIDUAL"),
});

export type CreateLeadInput = z.infer<typeof createLeadSchema>;
export type UpdateLeadInput = z.infer<typeof updateLeadSchema>;
