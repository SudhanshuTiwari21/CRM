import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { logActivity } from "@/lib/services/activity.service";
import { handleApiError, jsonOk, jsonError } from "@/lib/api-utils";
import { z } from "zod";

const schema = z.object({
  specialAssistanceUpdatedToAirline: z.boolean(),
});

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session?.user) return jsonError("Unauthorized", 401);

    const { id } = await params;
    const { specialAssistanceUpdatedToAirline } = schema.parse(await request.json());

    const booking = await prisma.booking.findUnique({
      where: { id },
      include: { flightBooking: true },
    });
    if (!booking) return jsonError("Booking not found", 404);
    if (!booking.flightBooking) return jsonError("Not a flight booking", 400);

    await prisma.flightBooking.update({
      where: { bookingId: id },
      data: { specialAssistanceUpdatedToAirline },
    });

    await logActivity({
      bookingId: id,
      userId: session.user.id,
      action: "SPECIAL_ASSISTANCE_STATUS_UPDATED",
      details: { specialAssistanceUpdatedToAirline },
    });

    return jsonOk({ specialAssistanceUpdatedToAirline });
  } catch (error) {
    return handleApiError(error);
  }
}
