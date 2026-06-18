import { requireAdmin } from "@/lib/auth";
import { generateBookingDocuments } from "@/lib/services/document.service";
import { handleApiError, jsonOk } from "@/lib/api-utils";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAdmin();

    const { id } = await params;
    const documents = await generateBookingDocuments(id, session.user.id);
    return jsonOk({ documents });
  } catch (error) {
    return handleApiError(error);
  }
}
