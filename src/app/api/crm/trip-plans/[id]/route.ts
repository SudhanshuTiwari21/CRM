import { auth } from "@/lib/auth";
import { updateTripPlanSchema } from "@/lib/validators/trip-plan";
import { deleteTripPlan, getTripPlanById, updateTripPlan } from "@/lib/services/trip-plan.service";
import { handleApiError, jsonOk, jsonError } from "@/lib/api-utils";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session?.user) return jsonError("Unauthorized", 401);

    const { id } = await params;
    const plan = await getTripPlanById(id);
    return jsonOk(plan);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session?.user) return jsonError("Unauthorized", 401);

    const { id } = await params;
    const body = await request.json();
    const data = updateTripPlanSchema.parse(body);
    const plan = await updateTripPlan(id, data, session.user.id);
    return jsonOk(plan);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session?.user) return jsonError("Unauthorized", 401);

    const { id } = await params;
    await deleteTripPlan(id);
    return jsonOk({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
