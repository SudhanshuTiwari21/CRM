export interface AllocatableBill {
  id: string;
  amountDue: number;
  createdAt?: string;
}

export function roundMoney(n: number) {
  return Math.round(n * 100) / 100;
}

/** FIFO allocation - oldest bills first (Tally-style). */
export function autoAllocatePayment(
  bills: AllocatableBill[],
  totalPayment: number
): Record<string, number> {
  const sorted = [...bills].sort((a, b) => {
    const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return ta - tb;
  });

  const allocations: Record<string, number> = {};
  let remaining = roundMoney(totalPayment);

  for (const bill of sorted) {
    if (remaining <= 0) break;
    const due = roundMoney(bill.amountDue);
    if (due <= 0) continue;
    const alloc = roundMoney(Math.min(remaining, due));
    if (alloc > 0) {
      allocations[bill.id] = alloc;
      remaining = roundMoney(remaining - alloc);
    }
  }

  return allocations;
}

export function sumAllocations(allocations: Record<string, number>) {
  return roundMoney(Object.values(allocations).reduce((s, v) => s + (v || 0), 0));
}
