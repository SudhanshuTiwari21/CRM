import { auth } from "@/lib/auth";
import { generateBookingDocuments } from "@/lib/services/document.service";
import { handleApiError, jsonOk, jsonError } from "@/lib/api-utils";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session?.user) return jsonError("Unauthorized", 401);

    const { id } = await params;
    const documents = await generateBookingDocuments(id, session.user.id);
    return jsonOk({ documents });
  } catch (error) {
    return handleApiError(error);
  }
}
