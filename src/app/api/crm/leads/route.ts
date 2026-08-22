import { auth } from "@/lib/auth";
import { createLeadSchema } from "@/lib/validators/lead";
import { createLead, listLeads } from "@/lib/services/lead.service";
import { handleApiError, jsonOk, jsonError } from "@/lib/api-utils";
import type { LeadProgressFilter } from "@/lib/validators/lead";
import type { LeadServiceType, LeadStatus, LeadTemperature } from "@prisma/client";

export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) return jsonError("Unauthorized", 401);

    const { searchParams } = new URL(request.url);
    const assignee = searchParams.get("assignee") || "ALL";

    const result = await listLeads({
      search: searchParams.get("search") || undefined,
      status: (searchParams.get("status") as LeadStatus | "ALL") || "ALL",
      temperature: (searchParams.get("temperature") as LeadTemperature | "ALL") || "ALL",
      progress: (searchParams.get("progress") as LeadProgressFilter) || "IN_PROGRESS",
      serviceType: (searchParams.get("serviceType") as LeadServiceType | "ALL") || "ALL",
      assignedAgentId: assignee === "ME" ? "ME" : assignee,
      assignedOpsId: searchParams.get("opsAssignee") || "ALL",
      currentUserId: session.user.id,
      page: parseInt(searchParams.get("page") || "1", 10),
      limit: parseInt(searchParams.get("limit") || "20", 10),
    });

    return jsonOk(result);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) return jsonError("Unauthorized", 401);

    const body = await request.json();
    const data = createLeadSchema.parse(body);
    const lead = await createLead(data, session.user.id);
    return jsonOk(lead, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
