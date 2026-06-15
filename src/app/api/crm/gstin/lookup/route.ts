import { auth } from "@/lib/auth";
import { lookupGstin } from "@/lib/gstin-lookup";
import { gstinLookupSchema } from "@/lib/validators/customer";
import { handleApiError, jsonOk, jsonError } from "@/lib/api-utils";

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) return jsonError("Unauthorized", 401);

    const body = await request.json();
    const { gstin } = gstinLookupSchema.parse(body);
    const result = await lookupGstin(gstin);

    return jsonOk(result);
  } catch (error) {
    return handleApiError(error);
  }
}
