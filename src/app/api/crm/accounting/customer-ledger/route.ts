import { auth } from "@/lib/auth";
import { getCustomerLedger, listLedgerCustomers } from "@/lib/services/customer-ledger.service";
import { handleApiError, jsonError, jsonOk } from "@/lib/api-utils";

export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) return jsonError("Unauthorized", 401);

    const { searchParams } = new URL(request.url);
    const customerId = searchParams.get("customerId");
    const listOnly = searchParams.get("list") === "customers";
    const search = searchParams.get("search") || undefined;

    if (listOnly) {
      const customers = await listLedgerCustomers(search);
      return jsonOk({ customers });
    }

    if (!customerId) return jsonError("customerId is required", 400);

    const fromRaw = searchParams.get("from");
    const toRaw = searchParams.get("to");
    const from = fromRaw ? new Date(fromRaw) : undefined;
    const to = toRaw ? new Date(toRaw) : undefined;
    if (to) to.setHours(23, 59, 59, 999);

    const report = await getCustomerLedger({ customerId, from, to });
    return jsonOk(report);
  } catch (error) {
    return handleApiError(error);
  }
}
