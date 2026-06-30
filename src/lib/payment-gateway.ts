export const CARD_PAYMENT_GATEWAY_RATE = 0.025;
export const CARD_PAYMENT_GATEWAY_RATE_LABEL = "2.5%";

export function isCardPaymentMethod(method?: string | null) {
  return method === "Card";
}

export function computeCardGatewayCharge(subtotal: number) {
  const base = Math.max(0, subtotal);
  return Math.round(base * CARD_PAYMENT_GATEWAY_RATE * 100) / 100;
}

export function applyCardGatewayCharge(subtotal: number, paymentMethod?: string | null) {
  const paymentGatewayCharge = isCardPaymentMethod(paymentMethod)
    ? computeCardGatewayCharge(subtotal)
    : 0;
  const totalAmount = Math.round((subtotal + paymentGatewayCharge) * 100) / 100;
  return { paymentGatewayCharge, totalAmount, invoiceSubtotal: subtotal };
}
