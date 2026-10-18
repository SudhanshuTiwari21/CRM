import { auth } from "@/lib/auth";
import { handleApiError, jsonOk, jsonError } from "@/lib/api-utils";
import { updateActivitySchema } from "@/lib/validators/activity";
import { deleteActivity, getActivityById, updateActivity } from "@/lib/services/activity-catalog.service";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session?.user) return jsonError("Unauthorized", 401);
    const { id } = await params;
    const activity = await getActivityById(id);
    if (!activity) return jsonError("Activity not found", 404);
    return jsonOk(activity);
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
    const data = updateActivitySchema.parse(body);
    const activity = await updateActivity(id, data);
    return jsonOk(activity);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session?.user) return jsonError("Unauthorized", 401);
    const { id } = await params;
    await deleteActivity(id);
    return jsonOk({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
