import { auth } from "@/lib/auth";
import { duplicateTripPlan } from "@/lib/services/trip-plan.service";
import { handleApiError, jsonOk, jsonError } from "@/lib/api-utils";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session?.user) return jsonError("Unauthorized", 401);

    const { id } = await params;
    const plan = await duplicateTripPlan(id, session.user.id);
    return jsonOk(plan, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
