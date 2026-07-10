import { roundMoney } from "@/lib/payment-allocation";

export interface AllocationSplit {
  bookingId: string;
  amount: number;
  wallet: number;
  received: number;
}

export function splitWalletAcrossAllocations(
  allocations: { bookingId: string; amount: number }[],
  walletAmount: number
): AllocationSplit[] {
  let remainingWallet = roundMoney(walletAmount);

  return allocations.map((alloc) => {
    const wallet = roundMoney(Math.min(alloc.amount, remainingWallet));
    const received = roundMoney(alloc.amount - wallet);
    remainingWallet = roundMoney(remainingWallet - wallet);
    return {
      bookingId: alloc.bookingId,
      amount: alloc.amount,
      wallet,
      received,
    };
  });
}
