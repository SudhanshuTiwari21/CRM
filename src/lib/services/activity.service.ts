import { prisma } from "@/lib/db";
import type { Prisma } from "@prisma/client";

export async function logActivity(params: {
  bookingId?: string;
  userId?: string;
  action: string;
  details?: Prisma.InputJsonValue;
}) {
  return prisma.activityLog.create({
    data: {
      bookingId: params.bookingId,
      userId: params.userId,
      action: params.action,
      details: params.details ?? undefined,
    },
  });
}
