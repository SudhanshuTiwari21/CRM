import type { BookingChannel, BookingStatus, ProductType } from "@prisma/client";

export const BOOKING_STATUS_LABELS: Record<BookingStatus, string> = {
  DRAFT: "Draft",
  PENDING_PAYMENT: "Pending Payment",
  PROCESSING: "Processing",
  CONFIRMED: "Confirmed",
  TICKET_SENT: "Ticket Sent",
  FAILED: "Failed",
  CANCELLED: "Cancelled",
};

export const BOOKING_STATUS_VARIANT: Record<BookingStatus, "default" | "secondary" | "success" | "warning" | "destructive" | "info" | "outline"> = {
  DRAFT: "secondary",
  PENDING_PAYMENT: "warning",
  PROCESSING: "info",
  CONFIRMED: "success",
  TICKET_SENT: "success",
  FAILED: "destructive",
  CANCELLED: "outline",
};

export const CHANNEL_LABELS: Record<BookingChannel, string> = {
  LIVE_API: "Live API",
  HELD: "Held",
  OFFLINE: "Offline Booking",
};

export const PRODUCT_LABELS: Record<ProductType, string> = {
  FLIGHT: "Flight",
  HOTEL: "Hotel",
  BUS: "Bus",
};

export const PAYMENT_METHODS = [
  "Cash",
  "UPI",
  "Card",
  "Bank Transfer",
  "Razorpay",
  "PayU",
  "CCAvenue",
  "PhonePe",
  "Paytm",
  "Stripe",
] as const;

export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: "LayoutDashboard" },
  { href: "/bookings", label: "Bookings", icon: "Plane" },
  { href: "/customers", label: "Customers", icon: "Users" },
  { href: "/documents", label: "Documents", icon: "FileText" },
  { href: "/reports", label: "Reports", icon: "BarChart3" },
  { href: "/settings", label: "Settings", icon: "Settings" },
] as const;
