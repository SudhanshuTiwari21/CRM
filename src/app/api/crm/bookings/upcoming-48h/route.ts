import { requireAdmin } from "@/lib/auth";
import { getUpcoming48HourTravel } from "@/lib/services/upcoming-travel.service";
import { handleApiError, jsonOk } from "@/lib/api-utils";

export async function GET() {
  try {
    await requireAdmin();
    const { flights, hotels } = await getUpcoming48HourTravel();
    return jsonOk({
      flights,
      hotels,
      // Backward-compatible alias used by older clients
      bookings: flights,
      total: flights.length + hotels.length,
      totals: {
        flights: flights.length,
        hotels: hotels.length,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
