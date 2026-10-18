import { auth } from "@/lib/auth";
import { handleApiError, jsonOk, jsonError } from "@/lib/api-utils";
import { activitySchema } from "@/lib/validators/activity";
import { createActivity, listActivities } from "@/lib/services/activity-catalog.service";

export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) return jsonError("Unauthorized", 401);

    const { searchParams } = new URL(request.url);
    const city = searchParams.get("city") || undefined;
    const search = searchParams.get("search") || undefined;
    const activeOnly = searchParams.get("activeOnly") === "true";

    const activities = await listActivities({ city, search, activeOnly });
    return jsonOk({ activities });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) return jsonError("Unauthorized", 401);

    const body = await request.json();
    const data = activitySchema.parse(body);
    const activity = await createActivity(data);
    return jsonOk(activity, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
