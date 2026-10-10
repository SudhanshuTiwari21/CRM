import { z } from "zod";
import { isValidIndianMobile, normalizePhone } from "@/lib/phone";

const optionalPhoneSchema = z
  .string()
  .optional()
  .or(z.literal(""))
  .transform((v) => (v?.trim() ? normalizePhone(v) : ""))
  .refine((v) => !v || isValidIndianMobile(v), "Enter a valid 10-digit Indian mobile number");

const leadTemperatureSchema = z.enum(["HOT", "WARM", "COLD", "NONE"]);
const leadServiceTypeSchema = z.enum(["PACKAGE", "FLIGHT", "HOTEL", "VISA", "BUS", "OTHER"]);
const leadCustomerSegmentSchema = z.enum(["B2C", "B2B"]);
const leadProgressSchema = z.enum([
  "IN_PROGRESS",
  "RECENT",
  "CONFIRMED",
  "CONVERTED",
  "LOST",
  "OVERALL",
]);

export const createLeadSchema = z.object({
  name: z.string().min(2, "Name is required"),
  phone: optionalPhoneSchema,
  email: z.string().email().optional().or(z.literal("")),
  company: z.string().optional(),
  source: z.enum(["PHONE", "WHATSAPP", "EMAIL", "WALK_IN", "REFERRAL", "WEBSITE", "OTHER"]).default("OTHER"),
  status: z.enum(["NEW", "CONTACTED", "QUALIFIED", "PROPOSAL", "WON", "LOST"]).optional(),
  temperature: leadTemperatureSchema.optional(),
  serviceType: leadServiceTypeSchema.optional().nullable(),
  customerSegment: leadCustomerSegmentSchema.optional(),
  productInterest: leadServiceTypeSchema.optional().nullable(),
  travelDate: z.string().optional().nullable(),
  returnDate: z.string().optional().nullable(),
  destinations: z.string().optional().nullable(),
  adultCount: z.coerce.number().int().min(0).optional().nullable(),
  childCount: z.coerce.number().int().min(0).optional().nullable(),
  infantCount: z.coerce.number().int().min(0).optional().nullable(),
  estimatedValue: z.coerce.number().min(0).optional().nullable(),
  nextFollowUpAt: z.string().optional().nullable(),
  requirement: z.string().optional(),
  assignedAgentId: z.string().optional().nullable(),
  assignedOpsId: z.string().optional().nullable(),
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

export const bulkAssignLeadsSchema = z.object({
  leadIds: z.array(z.string()).min(1),
  assignedAgentId: z.string().nullable().optional(),
  assignedOpsId: z.string().nullable().optional(),
});

export const createLeadTaskSchema = z.object({
  type: z.enum(["CALL", "TODO"]),
  direction: z.enum(["INCOMING", "OUTGOING"]).optional(),
  outcome: z
    .enum(["ANSWERED", "UNANSWERED", "NOT_REACHABLE", "CALLBACK", "LOST"])
    .optional(),
  scheduledAt: z.string().optional().nullable(),
  isCompleted: z.boolean().default(false),
  details: z.string().optional(),
  temperature: leadTemperatureSchema.optional(),
  assignedToId: z.string().optional().nullable(),
});

export const convertLeadSchema = z.object({
  createCustomer: z.boolean().default(true),
  customerType: z.enum(["INDIVIDUAL", "BUSINESS"]).default("INDIVIDUAL"),
});

export const leadListQuerySchema = z.object({
  search: z.string().optional(),
  status: z.enum(["NEW", "CONTACTED", "QUALIFIED", "PROPOSAL", "WON", "LOST", "ALL"]).optional(),
  temperature: z.enum(["HOT", "WARM", "COLD", "NONE", "ALL"]).optional(),
  progress: leadProgressSchema.optional(),
  serviceType: leadServiceTypeSchema.or(z.literal("ALL")).optional(),
  assignee: z.string().optional(),
  opsAssignee: z.string().optional(),
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

/** Form input types (pre-transform / pre-default) for react-hook-form */
export type CreateLeadInput = z.input<typeof createLeadSchema>;
export type CreateLeadParsed = z.output<typeof createLeadSchema>;
export type UpdateLeadInput = z.input<typeof updateLeadSchema>;
export type LeadNoteInput = z.output<typeof leadNoteSchema>;
export type LeadProgressFilter = z.infer<typeof leadProgressSchema>;
export type CreateLeadTaskInput = z.input<typeof createLeadTaskSchema>;
export type CreateLeadTaskParsed = z.output<typeof createLeadTaskSchema>;
