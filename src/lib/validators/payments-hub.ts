import { z } from "zod";
import { PAYMENT_METHODS } from "@/lib/constants";

const paymentBaseFields = {
  method: z.enum(PAYMENT_METHODS),
  referenceNumber: z.string().trim().optional().or(z.literal("")),
  note: z.string().trim().optional(),
  paidAt: z.string().datetime().optional(),
};

const allocationItemSchema = z.object({
  bookingId: z.string().min(1),
  amount: z.coerce.number().positive("Allocation must be greater than zero"),
});

export const recordPaymentSchema = z
  .discriminatedUnion("target", [
    z.object({
      target: z.literal("BOOKING"),
      billingType: z.enum(["CASH", "LEDGER"]),
      customerId: z.string().optional(),
      bookingId: z.string().optional(),
      amount: z.coerce.number().positive("Payment amount must be greater than zero"),
      walletAmount: z.coerce.number().min(0).optional(),
      allocations: z.array(allocationItemSchema).optional(),
      ...paymentBaseFields,
    }),
    z.object({
      target: z.literal("ADVANCE"),
      billingType: z.literal("LEDGER"),
      customerId: z.string().min(1),
      amount: z.coerce.number().positive("Amount must be greater than zero"),
      ...paymentBaseFields,
    }),
  ])
  .superRefine((data, ctx) => {
    if (data.target === "ADVANCE") return;

    const wallet = data.walletAmount ?? 0;
    const allocations = data.allocations ?? [];
    const allocTotal = allocations.reduce((s, a) => s + a.amount, 0);

    if (data.billingType === "LEDGER" && !data.customerId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Select a ledger customer",
        path: ["customerId"],
      });
    }

    if (wallet > data.amount + wallet && wallet > 0) {
      // wallet alone checked below
    }

    if (allocTotal > wallet + data.amount + 0.01) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Allocated amount exceeds payment received plus wallet",
        path: ["amount"],
      });
    }

    if (data.billingType === "CASH") {
      if (wallet > 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Wallet cannot be used for cash bills",
          path: ["walletAmount"],
        });
      }
      if (allocations.length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Allocate payment to at least one cash bill",
          path: ["allocations"],
        });
      }
      if (Math.abs(allocTotal - data.amount) > 0.01) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Cash payment must be fully allocated to bills",
          path: ["amount"],
        });
      }
    }

    if (!allocations.length && !data.bookingId && data.billingType === "CASH") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Select bills to allocate",
        path: ["allocations"],
      });
    }
  });

export const createCreditNoteSchema = z.object({
  customerId: z.string().min(1),
  bookingId: z.string().optional(),
  bookingPublicRef: z.string().trim().optional(),
  amount: z.coerce.number().positive("Amount must be greater than zero"),
  billingType: z.enum(["CASH", "LEDGER"]).optional(),
  reason: z.string().trim().optional(),
  notes: z.string().trim().optional(),
});

export type RecordPaymentInput = z.infer<typeof recordPaymentSchema>;
export type CreateCreditNoteInput = z.infer<typeof createCreditNoteSchema>;
