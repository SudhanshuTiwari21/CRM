import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { logActivity } from "@/lib/services/activity.service";
import { notifyHotelExtraServices } from "@/lib/services/hotel-extra-services-notify.service";
import { handleApiError, jsonOk, jsonError } from "@/lib/api-utils";
import { z } from "zod";

const schema = z.object({
  extraServicesNotifiedToHotel: z.boolean().optional(),
  /** Re-send auto email to hotel with voucher + notes */
  emailHotel: z.boolean().optional(),
});

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session?.user) return jsonError("Unauthorized", 401);

    const { id } = await params;
    const body = schema.parse(await request.json());

    const booking = await prisma.booking.findUnique({
      where: { id },
      include: { hotelBooking: true },
    });
    if (!booking) return jsonError("Booking not found", 404);
    if (!booking.hotelBooking) return jsonError("Not a hotel booking", 400);
    if (!booking.hotelBooking.extraServicesOpted) {
      return jsonError("This booking has no extra services opted", 400);
    }

    if (body.emailHotel) {
      const result = await notifyHotelExtraServices(id, {
        userId: session.user.id,
        force: true,
      });
      if ("skipped" in result && result.skipped) {
        return jsonError(result.reason, 400);
      }
      if ("success" in result && !result.success) {
        return jsonError(result.error, 500);
      }
      const refreshed = await prisma.hotelBooking.findUnique({ where: { bookingId: id } });
      return jsonOk({
        emailed: true,
        to: "to" in result ? result.to : undefined,
        extraServicesNotifiedToHotel: refreshed?.extraServicesNotifiedToHotel ?? true,
        extraServicesNotifiedAt: refreshed?.extraServicesNotifiedAt?.toISOString() ?? null,
      });
    }

    if (body.extraServicesNotifiedToHotel === undefined) {
      return jsonError("extraServicesNotifiedToHotel or emailHotel is required", 400);
    }

    const extraServicesNotifiedToHotel = body.extraServicesNotifiedToHotel;

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
