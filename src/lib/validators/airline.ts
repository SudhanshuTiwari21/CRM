import { z } from "zod";

const iataCodeField = z
  .string()
  .trim()
  .transform((v) => v.toUpperCase())
  .refine((v) => v === "" || /^[A-Z0-9]{2}$/.test(v), "IATA code must be 2 letters/digits");

const logoUrlField = z
  .string()
  .trim()
  .refine((v) => v === "" || /^https?:\/\//i.test(v), "Logo URL must be a valid http(s) link");

export const airlineProfileSchema = z.object({
  name: z.string().min(2),
  iataCode: iataCodeField.optional(),
  logoUrl: logoUrlField.optional(),
});

export const airlineProfileUpdateSchema = z.object({
  name: z.string().min(2).optional(),
  iataCode: iataCodeField.optional(),
  logoUrl: logoUrlField.optional(),
});
