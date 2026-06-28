import { auth } from "@/lib/auth";
import { findCustomerByPhone } from "@/lib/services/customer.service";
import { handleApiError, jsonOk, jsonError } from "@/lib/api-utils";
import { normalizePhone } from "@/lib/phone";

export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) return jsonError("Unauthorized", 401);

    const rawPhone = new URL(request.url).searchParams.get("phone")?.trim();
    if (!rawPhone || normalizePhone(rawPhone).length < 10) {
      return jsonError("Phone number required", 400);
    }

    const customer = await findCustomerByPhone(rawPhone);

    if (!customer) {
      return jsonOk({ customer: null });
    }

    return jsonOk({
      customer: {
        id: customer.id,
        name: customer.name,
        type: customer.type,
        creditEnabled: customer.creditEnabled,
        creditLimit: customer.creditLimit,
        creditBalance: customer.creditBalance,
        paymentTermsDays: customer.paymentTermsDays,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
