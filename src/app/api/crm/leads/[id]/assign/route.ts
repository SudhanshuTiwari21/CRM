import { auth } from "@/lib/auth";
import { assignLeadSchema } from "@/lib/validators/lead";
import { assignLead } from "@/lib/services/lead.service";
import { handleApiError, jsonOk, jsonError } from "@/lib/api-utils";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session?.user) return jsonError("Unauthorized", 401);

    const { id } = await params;
    const body = await request.json();
    const data = assignLeadSchema.parse(body);
    const lead = await assignLead(id, data.assignedAgentId, session.user.id);
    return jsonOk(lead);
  } catch (error) {
    return handleApiError(error);
  }
}
