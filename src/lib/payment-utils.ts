import type { Payment, PaymentStatus } from "@prisma/client";

export function roundMoney(n: number) {
  return Math.round(n * 100) / 100;
}

export function sumPaidPayments(payments: Pick<Payment, "amount" | "status">[]) {
  return roundMoney(
    payments
      .filter((p) => p.status === "PAID")
      .reduce((sum, p) => sum + Number(p.amount), 0)
  );
}

export function computeAmountDue(totalAmount: number, paidAmount: number) {
  return roundMoney(Math.max(0, totalAmount - paidAmount));
}

export function deriveBookingPaymentStatus(
  totalAmount: number,
  paidAmount: number,
  hasCreditCharge: boolean
): PaymentStatus {
  const due = computeAmountDue(totalAmount, paidAmount);
  if (due <= 0) return "PAID";
  if (paidAmount > 0) return "PARTIAL";
  return hasCreditCharge ? "ON_CREDIT" : "PENDING";
}

export function bookingHasCreditCharge(payments: Pick<Payment, "status">[]) {
  return payments.some((p) => p.status === "ON_CREDIT");
}

export const OPEN_PAYMENT_STATUSES: PaymentStatus[] = ["PENDING", "ON_CREDIT", "PARTIAL"];

export const GATEWAY_PAYMENT_METHODS = [
  "Razorpay",
  "PayU",
  "CCAvenue",
  "PhonePe",
  "Paytm",
  "Stripe",
] as const;

export function isGatewayMethod(method: string) {
  return (GATEWAY_PAYMENT_METHODS as readonly string[]).includes(method);
}
