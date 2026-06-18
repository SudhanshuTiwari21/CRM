import { z } from "zod";

export const adminBookingUpdateSchema = z.object({
  pnr: z.string().optional(),
  internalNotes: z.string().optional(),
  totalAmount: z.coerce.number().positive().optional(),
  invoiceNarration: z.string().optional(),
  showPassengerName: z.boolean().optional(),
  baseFare: z.coerce.number().min(0).optional(),
  serviceCharge: z.coerce.number().min(0).optional(),
  discountAmount: z.coerce.number().min(0).optional(),
  regenerateDocuments: z.boolean().optional(),
});

export const customerCreditSettingsSchema = z.object({
  creditEnabled: z.boolean(),
  creditLimit: z.coerce.number().min(0).nullable().optional(),
  paymentTermsDays: z.coerce.number().int().min(0).nullable().optional(),
});
