import { z } from "zod";

const moneyField = z.coerce.number().min(0).optional();

export const b2bCancelSchema = z.object({
  category: z.literal("B2B"),
  reason: z.string().min(1, "Reason is required"),
  airlineRefund: moneyField,
  supplierCharges: moneyField,
  agencyCharges: moneyField,
  refundToCredit: z.boolean().optional(),
  notes: z.string().optional(),
});

export const b2cCancelSchema = z.object({
  category: z.literal("B2C"),
  reason: z.string().min(1, "Reason is required"),
  customerRefund: moneyField,
  cancellationFee: moneyField,
  supplierPenalty: moneyField,
  refundToCredit: z.boolean().optional(),
  notes: z.string().optional(),
});

export const bookingCancelSchema = z.discriminatedUnion("category", [b2bCancelSchema, b2cCancelSchema]);

export type BookingCancelInput = z.infer<typeof bookingCancelSchema>;
