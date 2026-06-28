import { auth } from "@/lib/auth";
import { getPendingPayments } from "@/lib/services/pending-payments.service";
import { handleApiError, jsonOk, jsonError } from "@/lib/api-utils";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) return jsonError("Unauthorized", 401);

    const report = await getPendingPayments();
    return jsonOk(report);
  } catch (error) {
    return handleApiError(error);
  }
}
