import { auth } from "@/lib/auth";
import { sendItineraryWithPnr } from "@/lib/services/booking.service";
import { sendItinerarySchema } from "@/lib/validators/booking";
import { handleApiError, jsonOk, jsonError } from "@/lib/api-utils";

export const runtime = "nodejs";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session?.user) return jsonError("Unauthorized", 401);

    const { id } = await params;
    const body = await request.json();
    const { pnr, secondaryPnr, ticketNumbers } = sendItinerarySchema.parse(body);

    await sendItineraryWithPnr(id, pnr, session.user.id, secondaryPnr, ticketNumbers);
    return jsonOk({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
