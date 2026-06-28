import { auth } from "@/lib/auth";
import { deleteSavedPassenger } from "@/lib/services/saved-passenger.service";
import { handleApiError, jsonError, jsonOk } from "@/lib/api-utils";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) return jsonError("Unauthorized", 401);

    const { id } = await params;
    await deleteSavedPassenger(id);
    return jsonOk({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
