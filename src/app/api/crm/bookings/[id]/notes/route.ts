import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { logActivity } from "@/lib/services/activity.service";
import { handleApiError, jsonOk, jsonError } from "@/lib/api-utils";
import { z } from "zod";

const schema = z.object({
  note: z.string().min(1),
});

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session?.user) return jsonError("Unauthorized", 401);

    const { id } = await params;
    const { note } = schema.parse(await request.json());

    const existing = await prisma.booking.findUnique({ where: { id }, select: { internalNotes: true } });
    if (!existing) return jsonError("Booking not found", 404);

    const timestamp = new Date().toISOString().slice(0, 16).replace("T", " ");
    const entry = `[${timestamp} ${session.user.name}] ${note}`;
    const internalNotes = existing.internalNotes ? `${existing.internalNotes}\n${entry}` : entry;

    const booking = await prisma.booking.update({
      where: { id },
      data: { internalNotes },
    });

    await logActivity({
      bookingId: id,
      userId: session.user.id,
      action: "NOTE_ADDED",
      details: { note },
    });

    return jsonOk(booking);
  } catch (error) {
    return handleApiError(error);
  }
}
