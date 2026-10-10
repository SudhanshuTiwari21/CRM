import { getStateFromGstin } from "@/lib/gstin-lookup";

export const FLIGHT_SERVICE_HSN = "998551";
/** Tour operator / hotel booking agency service (SAC) */
export const HOTEL_SERVICE_HSN = "998552";
export const FLIGHT_GST_RATE = 18;
export const INTRA_STATE_SPLIT_RATE = 9;

export interface FlightGstBreakdown {
  taxableValue: number;
  cgstRate: number;
  sgstRate: number;
  igstRate: number;
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
  totalTax: number;
  isInterState: boolean;
  buyerStateCode: string | null;
  buyerState: string | null;
  placeOfSupply: string | null;
}

function round2(value: number) {
  return Math.round(value * 100) / 100;
}

export function getStateCodeFromGstin(gstin?: string | null) {
  if (!gstin || gstin.length < 2) return null;
  return gstin.slice(0, 2).toUpperCase();
}

export function calculateFlightGst(params: {
  serviceCharge: number;
  agencyStateCode?: string | null;
  buyerGstin?: string | null;
  buyerState?: string | null;
  invoiceTaxType?: "ITC" | "NON_ITC";
}): FlightGstBreakdown {
  const taxableValue = round2(Math.max(params.serviceCharge, 0));
  const buyerStateCode = getStateCodeFromGstin(params.buyerGstin);
  const buyerState =
    params.buyerState ||
    (params.buyerGstin ? getStateFromGstin(params.buyerGstin) : null) ||
    null;

  const agencyStateCode = params.agencyStateCode || null;
  const placeOfSupply = buyerState || null;

  const isInterState =
    params.invoiceTaxType === "ITC" &&
    !!agencyStateCode &&
    !!buyerStateCode &&
    agencyStateCode !== buyerStateCode;

  if (isInterState) {
    const igstAmount = round2(taxableValue * (FLIGHT_GST_RATE / 100));
    return {
      taxableValue,
      cgstRate: 0,
      sgstRate: 0,
      igstRate: FLIGHT_GST_RATE,
      cgstAmount: 0,
      sgstAmount: 0,
      igstAmount,
      totalTax: igstAmount,
      isInterState: true,
      buyerStateCode,
      buyerState,
      placeOfSupply,
    };
  }

  const cgstAmount = round2(taxableValue * (INTRA_STATE_SPLIT_RATE / 100));
  const sgstAmount = round2(taxableValue * (INTRA_STATE_SPLIT_RATE / 100));

  return {
    taxableValue,
    cgstRate: INTRA_STATE_SPLIT_RATE,
    sgstRate: INTRA_STATE_SPLIT_RATE,
    igstRate: 0,
    cgstAmount,
    sgstAmount,
    igstAmount: 0,
    totalTax: round2(cgstAmount + sgstAmount),
    isInterState: false,
    buyerStateCode,
    buyerState,
    placeOfSupply,
  };
}

export function calculateFlightInvoiceTotal(
  baseFare: number,
  serviceCharge: number,
  tax: FlightGstBreakdown,
  discountAmount = 0
) {
  const discount = round2(Math.max(discountAmount, 0));
  return round2(baseFare + serviceCharge + tax.totalTax - discount);
}

export function formatInr(amount: number) {
  return `₹${amount.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
