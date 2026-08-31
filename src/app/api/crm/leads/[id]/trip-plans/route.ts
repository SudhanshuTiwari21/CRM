import { auth } from "@/lib/auth";
import { createTripPlanSchema } from "@/lib/validators/trip-plan";
import { createTripPlan, listTripPlansForLead } from "@/lib/services/trip-plan.service";
import { handleApiError, jsonOk, jsonError } from "@/lib/api-utils";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session?.user) return jsonError("Unauthorized", 401);

    const { id } = await params;
    const plans = await listTripPlansForLead(id);
    return jsonOk(plans);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session?.user) return jsonError("Unauthorized", 401);

    const { id } = await params;
    const body = await request.json();
    const data = createTripPlanSchema.parse(body);
    const plan = await createTripPlan(id, data, session.user.id);
    return jsonOk(plan, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
