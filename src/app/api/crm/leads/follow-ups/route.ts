import { auth } from "@/lib/auth";
import { getLeadFollowUpSummary } from "@/lib/services/lead.service";
import { handleApiError, jsonOk, jsonError } from "@/lib/api-utils";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) return jsonError("Unauthorized", 401);

    const summary = await getLeadFollowUpSummary();
    return jsonOk(summary);
  } catch (error) {
    return handleApiError(error);
  }
}
