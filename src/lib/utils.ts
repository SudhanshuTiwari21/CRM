import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function toNumber(amount: number | string | { toString(): string }) {
  return typeof amount === "number" ? amount : parseFloat(amount.toString());
}

export function formatCurrency(amount: number | string | { toString(): string }, currency = "INR") {
  const value = toNumber(amount);
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatDate(date: Date | string, options?: Intl.DateTimeFormatOptions) {
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    ...options,
  }).format(d);
}

export function formatDateTime(date: Date | string) {
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(d);
}

import { CUSTOMER_TITLE_OPTIONS } from "@/lib/constants/flight";

/** Split stored full name into title prefix and remainder for form fields. */
export function splitCustomerName(fullName: string) {
  const parts = fullName.trim().split(/\s+/);
  const titles = CUSTOMER_TITLE_OPTIONS.map((o) => o.value);
  if (parts.length > 1 && titles.includes(parts[0] as (typeof titles)[number])) {
    return { title: parts[0], name: parts.slice(1).join(" ") };
  }
  return { title: "Mr", name: fullName };
}

/** Combine optional title with customer name for storage/display. */
export function formatCustomerName(title: string | undefined, name: string) {
  const trimmed = name.trim();
  if (!trimmed) return trimmed;
  const t = title?.trim();
  if (!t) return trimmed;
  const lower = trimmed.toLowerCase();
  if (lower.startsWith(`${t.toLowerCase()} `) || lower.startsWith(`${t.toLowerCase()}.`)) {
    return trimmed;
  }
  return `${t} ${trimmed}`;
}
