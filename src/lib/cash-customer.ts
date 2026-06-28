/** System placeholder — not a real customer profile. Cash contact details live in booking metadata. */
export const CASH_WALK_IN_PHONE = "0000000000";

export type CashCustomerSnapshot = {
  name: string;
  phone: string;
  email?: string | null;
  pan?: string | null;
  gstin?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  pincode?: string | null;
};

export type BookingCustomerContact = {
  name: string;
  phone: string;
  email?: string | null;
  pan?: string | null;
  gstin?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  pincode?: string | null;
};

export function formatBillingAddress(contact: {
  address?: string | null;
  city?: string | null;
  state?: string | null;
  pincode?: string | null;
}) {
  return [contact.address, contact.city, contact.state, contact.pincode].filter(Boolean).join(", ");
}

export function isCashWalkInPhone(phone: string) {
  return phone === CASH_WALK_IN_PHONE;
}

export function parseCashCustomerSnapshot(metadata: unknown): CashCustomerSnapshot | null {
  if (!metadata || typeof metadata !== "object") return null;
  const cash = (metadata as { cashCustomer?: unknown }).cashCustomer;
  if (!cash || typeof cash !== "object") return null;
  const c = cash as Record<string, unknown>;
  if (typeof c.name !== "string" || typeof c.phone !== "string") return null;
  return {
    name: c.name,
    phone: c.phone,
    email: typeof c.email === "string" ? c.email : null,
    pan: typeof c.pan === "string" ? c.pan : null,
    gstin: typeof c.gstin === "string" ? c.gstin : null,
    address: typeof c.address === "string" ? c.address : null,
    city: typeof c.city === "string" ? c.city : null,
    state: typeof c.state === "string" ? c.state : null,
    pincode: typeof c.pincode === "string" ? c.pincode : null,
  };
}

export function getBookingCustomerContact(booking: {
  billingType: string;
  metadata: unknown;
  customer: BookingCustomerContact;
}): BookingCustomerContact {
  if (booking.billingType === "CASH") {
    const snap = parseCashCustomerSnapshot(booking.metadata);
    if (snap) return snap;
  }
  return booking.customer;
}
