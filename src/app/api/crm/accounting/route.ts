import { auth } from "@/lib/auth";
import { getAccountingBills } from "@/lib/services/accounting.service";
import { handleApiError, jsonOk, jsonError } from "@/lib/api-utils";

export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) return jsonError("Unauthorized", 401);

    const { searchParams } = new URL(request.url);
    const type = (searchParams.get("type") || "ALL") as "ALL" | "ITC" | "NON_ITC";
    const fromStr = searchParams.get("from");
    const toStr = searchParams.get("to");

    const from = fromStr ? new Date(fromStr) : undefined;
    const to = toStr ? new Date(`${toStr}T23:59:59.999Z`) : undefined;

    const data = await getAccountingBills({ type, from, to });
    return jsonOk(data);
  } catch (error) {
    return handleApiError(error);
  }
}
