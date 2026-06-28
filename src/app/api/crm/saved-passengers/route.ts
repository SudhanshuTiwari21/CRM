import { auth } from "@/lib/auth";
import {
  listSavedPassengers,
  upsertSavedPassenger,
} from "@/lib/services/saved-passenger.service";
import { upsertSavedPassengerSchema } from "@/lib/validators/saved-passenger";
import { handleApiError, jsonError, jsonOk } from "@/lib/api-utils";

export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) return jsonError("Unauthorized", 401);

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || undefined;
    const passengers = await listSavedPassengers(search);
    return jsonOk({ passengers });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) return jsonError("Unauthorized", 401);

    const body = await request.json();
    const data = upsertSavedPassengerSchema.parse(body);
    const result = await upsertSavedPassenger(data, session.user.id);
    return jsonOk(result);
  } catch (error) {
    return handleApiError(error);
  }
}
