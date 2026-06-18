import { auth } from "@/lib/auth";
import { confirmBookingPnr } from "@/lib/services/booking.service";
import { confirmPnrSchema } from "@/lib/validators/booking";
import { handleApiError, jsonOk, jsonError } from "@/lib/api-utils";

export const runtime = "nodejs";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session?.user) return jsonError("Unauthorized", 401);

    const { id } = await params;
    const body = await request.json();
    const { pnr, supplierRef, secondaryPnr } = confirmPnrSchema.parse(body);

    const booking = await confirmBookingPnr(id, pnr, supplierRef, session.user.id, secondaryPnr);
    return jsonOk(booking);
  } catch (error) {
    return handleApiError(error);
  }
}
