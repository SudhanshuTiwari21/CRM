import { requireAdmin } from "@/lib/auth";
import { resendBookingEmail } from "@/lib/services/booking.service";
import { handleApiError, jsonOk } from "@/lib/api-utils";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAdmin();

    const { id } = await params;
    await resendBookingEmail(id, session.user.id);
    return jsonOk({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
