import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { logActivity } from "@/lib/services/activity.service";
import { handleApiError, jsonOk, jsonError } from "@/lib/api-utils";
import { z } from "zod";

const schema = z.object({
  extraServicesNotifiedToHotel: z.boolean(),
});

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session?.user) return jsonError("Unauthorized", 401);

    const { id } = await params;
    const { extraServicesNotifiedToHotel } = schema.parse(await request.json());

    const booking = await prisma.booking.findUnique({
      where: { id },
      include: { hotelBooking: true },
    });
    if (!booking) return jsonError("Booking not found", 404);
    if (!booking.hotelBooking) return jsonError("Not a hotel booking", 400);
    if (!booking.hotelBooking.extraServicesOpted) {
      return jsonError("This booking has no extra services opted", 400);
    }

    await prisma.hotelBooking.update({
      where: { bookingId: id },
      data: {
        extraServicesNotifiedToHotel,
        extraServicesNotifiedAt: extraServicesNotifiedToHotel ? new Date() : null,
      },
    });

    await logActivity({
      bookingId: id,
      userId: session.user.id,
      action: "EXTRA_SERVICES_NOTIFY_STATUS_UPDATED",
      details: { extraServicesNotifiedToHotel },
    });

    return jsonOk({
      extraServicesNotifiedToHotel,
      extraServicesNotifiedAt: extraServicesNotifiedToHotel ? new Date().toISOString() : null,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
