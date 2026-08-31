import type { TripMarkupType } from "@prisma/client";

export function computeItemSellPrice(
  costPrice: number,
  quantity: number,
  markupType: TripMarkupType,
  markupValue: number
) {
  const base = costPrice * quantity;
  if (markupType === "PERCENT") {
    return Math.round(base * (1 + markupValue / 100) * 100) / 100;
  }
  return Math.round((base + markupValue) * 100) / 100;
}

export function computeTripTotals(
  items: { costPrice: number; quantity: number; sellPrice: number }[],
  gstRate?: number | null,
  offerPriceOverride?: number | null
) {
  const subtotalCost = items.reduce((sum, i) => sum + i.costPrice * i.quantity, 0);
  const subtotalSell = items.reduce((sum, i) => sum + i.sellPrice, 0);
  const gstAmount =
    gstRate != null && gstRate > 0 ? Math.round(subtotalSell * (gstRate / 100) * 100) / 100 : null;
  const computedOffer = subtotalSell + (gstAmount ?? 0);
  const offerPrice = offerPriceOverride != null ? offerPriceOverride : computedOffer;

  return {
    subtotalCost: Math.round(subtotalCost * 100) / 100,
    subtotalSell: Math.round(subtotalSell * 100) / 100,
    gstAmount,
    offerPrice: Math.round(offerPrice * 100) / 100,
  };
}
