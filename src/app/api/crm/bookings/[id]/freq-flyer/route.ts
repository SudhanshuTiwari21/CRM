import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { logActivity } from "@/lib/services/activity.service";
import { handleApiError, jsonOk, jsonError } from "@/lib/api-utils";
import { z } from "zod";

const schema = z.object({
  freqFlyerUpdatedToAirline: z.boolean(),
});

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session?.user) return jsonError("Unauthorized", 401);

    const { id } = await params;
    const { freqFlyerUpdatedToAirline } = schema.parse(await request.json());

    const booking = await prisma.booking.findUnique({
      where: { id },
      include: { flightBooking: true },
    });
    if (!booking) return jsonError("Booking not found", 404);
    if (!booking.flightBooking) return jsonError("Not a flight booking", 400);

    await prisma.flightBooking.update({
      where: { bookingId: id },
      data: { freqFlyerUpdatedToAirline },
    });

    await logActivity({
      bookingId: id,
      userId: session.user.id,
      action: "FREQ_FLYER_STATUS_UPDATED",
      details: { freqFlyerUpdatedToAirline },
    });

    return jsonOk({ freqFlyerUpdatedToAirline });
  } catch (error) {
    return handleApiError(error);
  }
}
