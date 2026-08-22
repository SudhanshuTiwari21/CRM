import { auth } from "@/lib/auth";
import { bulkAssignLeadsSchema } from "@/lib/validators/lead";
import { bulkAssignLeads } from "@/lib/services/lead.service";
import { handleApiError, jsonOk, jsonError } from "@/lib/api-utils";

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) return jsonError("Unauthorized", 401);

    const body = await request.json();
    const data = bulkAssignLeadsSchema.parse(body);

    if (data.assignedAgentId === undefined && data.assignedOpsId === undefined) {
      return jsonError("Provide assignedAgentId and/or assignedOpsId", 400);
    }

    const result = await bulkAssignLeads(
      data.leadIds,
      {
        assignedAgentId: data.assignedAgentId,
        assignedOpsId: data.assignedOpsId,
      },
      session.user.id
    );

    return jsonOk(result);
  } catch (error) {
    return handleApiError(error);
  }
}
