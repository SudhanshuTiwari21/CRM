import type { Booking, Customer, FlightBooking, ProductType } from "@prisma/client";
import type { CancellationCategory } from "@prisma/client";

type BookingWithRelations = Booking & {
  customer: Pick<Customer, "type">;
  flightBooking: FlightBooking | null;
};

export function resolveCancellationCategory(booking: BookingWithRelations): CancellationCategory {
  if (booking.productType === "FLIGHT" && booking.flightBooking) {
    return booking.flightBooking.invoiceTaxType === "ITC" ? "B2B" : "B2C";
  }
  if (booking.productType === "HOTEL") {
    return booking.customer.type === "BUSINESS" ? "B2B" : "B2C";
  }
  return booking.customer.type === "BUSINESS" ? "B2B" : "B2C";
}

export function cancellationCategoryLabel(category: CancellationCategory) {
  return category === "B2B" ? "B2B" : "B2C";
}

export function canCancelProductType(productType: ProductType) {
  return productType === "FLIGHT" || productType === "HOTEL";
}

export function computeB2BNetRefund(
  airlineRefund: number,
  supplierCharges: number,
  agencyCharges: number
) {
  return Math.max(0, Math.round((airlineRefund - supplierCharges - agencyCharges) * 100) / 100);
}
