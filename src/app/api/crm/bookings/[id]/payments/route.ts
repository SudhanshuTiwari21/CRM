import { auth } from "@/lib/auth";
import { recordBookingPayment } from "@/lib/services/booking-payment.service";
import { recordBookingPaymentSchema } from "@/lib/validators/payment";
import { handleApiError, jsonError, jsonOk } from "@/lib/api-utils";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) return jsonError("Unauthorized", 401);

    const { id } = await params;
    const body = await request.json();
    const data = recordBookingPaymentSchema.parse(body);
    const result = await recordBookingPayment(id, data, session.user.id);
    return jsonOk(result);
  } catch (error) {
    return handleApiError(error);
  }
}
