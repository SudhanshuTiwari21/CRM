import { z } from "zod";
import { PAYMENT_METHODS } from "@/lib/constants";

export const recordBookingPaymentSchema = z.object({
  amount: z.coerce.number().positive("Amount must be greater than zero"),
  method: z.enum(PAYMENT_METHODS),
  gatewayRef: z.string().trim().optional().or(z.literal("")),
  referenceNumber: z.string().trim().optional().or(z.literal("")),
  paidAt: z.string().datetime().optional(),
  note: z.string().trim().optional(),
  billingType: z.enum(["CASH", "LEDGER"]).optional(),
});

export type RecordBookingPaymentInput = z.infer<typeof recordBookingPaymentSchema>;
