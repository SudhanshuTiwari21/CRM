import { auth, requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { adminBookingUpdateSchema } from "@/lib/validators/booking-admin";
import { updateBookingAsAdmin, deleteBookingWithRenumber } from "@/lib/services/booking-admin.service";
import { handleApiError, jsonOk, jsonError } from "@/lib/api-utils";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session?.user) return jsonError("Unauthorized", 401);

    const { id } = await params;

    const booking = await prisma.booking.findUnique({
      where: { id },
      include: {
        customer: true,
        assignedAgent: { select: { id: true, name: true, email: true } },
        flightBooking: true,
        hotelBooking: true,
        busBooking: true,
        payments: true,
        documents: true,
        emailLogs: { orderBy: { createdAt: "desc" } },
        activityLogs: {
          include: { user: { select: { name: true } } },
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!booking) return jsonError("Booking not found", 404);
    return jsonOk(booking);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAdmin();
    const { id } = await params;
    const body = await request.json();
    const data = adminBookingUpdateSchema.parse(body);
    const booking = await updateBookingAsAdmin(id, data, session.user.id);
    return jsonOk(booking);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAdmin();
    const { id } = await params;
    const result = await deleteBookingWithRenumber(id, session.user.id);
    return jsonOk(result);
  } catch (error) {
    return handleApiError(error);
  }
}
