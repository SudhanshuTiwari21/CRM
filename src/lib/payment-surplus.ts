import { roundMoney } from "@/lib/payment-allocation";

/** Receipt used on bills after wallet is applied. */
export function receiptUsedForBills(allocatedTotal: number, walletAmount: number) {
  return roundMoney(Math.max(0, allocatedTotal - walletAmount));
}

/** Leftover receipt auto-credited to customer advance/wallet. */
export function surplusToAdvance(
  receiptAmount: number,
  allocatedTotal: number,
  walletAmount: number
) {
  return roundMoney(receiptAmount - receiptUsedForBills(allocatedTotal, walletAmount));
}

export function totalAvailableForBills(receiptAmount: number, walletAmount: number) {
  return roundMoney(receiptAmount + walletAmount);
}
