import { z } from "zod";

export const hotelProfileSchema = z.object({
  name: z.string().min(2),
  address: z.string().min(3),
  city: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  checkInTime: z.string().optional(),
  checkOutTime: z.string().optional(),
});

export const hotelProfileUpdateSchema = hotelProfileSchema.partial().extend({
  name: z.string().min(2).optional(),
});
