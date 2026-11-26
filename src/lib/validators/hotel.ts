import { z } from "zod";

const optionalEmail = z.string().email().optional().or(z.literal(""));

export const hotelProfileSchema = z.object({
  name: z.string().min(2),
  address: z.string().min(3),
  city: z.string().optional(),
  country: z.string().optional(),
  phone: z.string().optional(),
  email: optionalEmail,
  emails: z.array(optionalEmail).max(3).optional(),
  checkInTime: z.string().optional(),
  checkOutTime: z.string().optional(),
});

export const hotelProfileUpdateSchema = hotelProfileSchema.partial().extend({
  name: z.string().min(2).optional(),
});

/** Dedupe (case-insensitive), trim, keep max 3; sync primary `email`. */
export function normalizeHotelEmails(input: {
  emails?: (string | null | undefined)[] | null;
  email?: string | null;
}): { email: string | null; emails: string[] } {
  const raw = [...(input.emails || []), input.email]
    .filter((e): e is string => typeof e === "string" && e.trim().length > 0)
    .map((e) => e.trim());

  const seen = new Set<string>();
  const emails: string[] = [];
  for (const e of raw) {
    const key = e.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    emails.push(e);
    if (emails.length >= 3) break;
  }

  return { emails, email: emails[0] ?? null };
}

/** Prefer emails[]; fall back to legacy single email for forms/display. */
export function hotelEmailsForForm(hotel: {
  emails?: string[] | null;
  email?: string | null;
}): [string, string, string] {
  const { emails } = normalizeHotelEmails({
    emails: hotel.emails?.length ? hotel.emails : undefined,
    email: hotel.email,
  });
  return [emails[0] || "", emails[1] || "", emails[2] || ""];
}
