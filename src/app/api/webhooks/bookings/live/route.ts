import { createLiveBooking } from "@/lib/services/booking.service";
import { webhookLiveBookingSchema } from "@/lib/validators/booking";
import { handleApiError, jsonOk, jsonError } from "@/lib/api-utils";
import { validateWebhookApiKey } from "@/lib/api-utils";

export async function POST(request: Request) {
  try {
    await validateWebhookApiKey(request);

    const body = await request.json();
    const input = webhookLiveBookingSchema.parse(body);
    const booking = await createLiveBooking(input);

    return jsonOk({
      success: true,
      publicRef: booking.publicRef,
      pnr: booking.pnr,
      status: booking.status,
    }, 201);
  } catch (error) {
    if (error instanceof Error && error.message === "Invalid API key") {
      return jsonError("Invalid API key", 401);
    }
    return handleApiError(error);
  }
}
