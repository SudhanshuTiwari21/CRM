import { auth, requireAdmin } from "@/lib/auth";
import { updateLeadSchema } from "@/lib/validators/lead";
import { deleteLead, getLeadById, updateLead } from "@/lib/services/lead.service";
import { handleApiError, jsonOk, jsonError } from "@/lib/api-utils";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session?.user) return jsonError("Unauthorized", 401);

    const { id } = await params;
    const lead = await getLeadById(id);
    if (!lead) return jsonError("Lead not found", 404);
    return jsonOk(lead);
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
    const data = updateLeadSchema.parse(body);
    const lead = await updateLead(id, data, session.user.id);
    return jsonOk(lead);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin();
    const { id } = await params;
    const result = await deleteLead(id);
    return jsonOk(result);
  } catch (error) {
    return handleApiError(error);
  }
}
