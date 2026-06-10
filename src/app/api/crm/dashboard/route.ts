import { auth } from "@/lib/auth";
import { getDashboardStats } from "@/lib/services/booking.service";
import { handleApiError, jsonOk, jsonError } from "@/lib/api-utils";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) return jsonError("Unauthorized", 401);

    const stats = await getDashboardStats();
    return jsonOk(stats);
  } catch (error) {
    return handleApiError(error);
  }
}
