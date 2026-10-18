import { z } from "zod";

export const activitySchema = z.object({
  city: z.string().min(1, "City is required"),
  country: z.string().optional().nullable(),
  name: z.string().min(1, "Activity name is required"),
  description: z.string().optional().nullable(),
  tag: z.string().optional().nullable(),
  startTimes: z.string().optional().nullable(),
  duration: z.string().optional().nullable(),
  costPrice: z.coerce.number().min(0).default(0),
  sellPrice: z.coerce.number().min(0).default(0),
  active: z.boolean().optional().default(true),
});

export const updateActivitySchema = activitySchema.partial();

export type ActivityInput = z.infer<typeof activitySchema>;
