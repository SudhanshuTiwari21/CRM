import { requireAdmin } from "@/lib/auth";
import { getUpcoming48HourFlightBookings } from "@/lib/services/upcoming-travel.service";
import { handleApiError, jsonOk } from "@/lib/api-utils";

export async function GET() {
  try {
    await requireAdmin();
    const bookings = await getUpcoming48HourFlightBookings();
    return jsonOk({ bookings, total: bookings.length });
  } catch (error) {
    return handleApiError(error);
  }
}
