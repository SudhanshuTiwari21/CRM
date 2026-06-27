import { requireAdmin } from "@/lib/auth";
import { cancelBooking } from "@/lib/services/cancellation.service";
import { bookingCancelSchema } from "@/lib/validators/booking-cancel";
import { handleApiError, jsonOk } from "@/lib/api-utils";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAdmin();
    const { id } = await params;
    const body = await request.json();
    const input = bookingCancelSchema.parse(body);
    const cancellation = await cancelBooking(id, input, session.user.id);
    return jsonOk(cancellation);
  } catch (error) {
    return handleApiError(error);
  }
}
