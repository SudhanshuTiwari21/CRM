import { auth, requireAdmin } from "@/lib/auth";
import { customerCreditSettingsSchema } from "@/lib/validators/booking-admin";
import {
  getCustomerCreditSummary,
  listCreditTransactions,
  updateCustomerCreditSettings,
} from "@/lib/services/credit.service";
import { handleApiError, jsonOk, jsonError } from "@/lib/api-utils";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session?.user) return jsonError("Unauthorized", 401);

    const { id } = await params;
    const [summary, transactions] = await Promise.all([
      getCustomerCreditSummary(id),
      listCreditTransactions(id),
    ]);

    return jsonOk({ ...summary, transactions });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin();
    const { id } = await params;
    const body = await request.json();
    const data = customerCreditSettingsSchema.parse(body);
    const customer = await updateCustomerCreditSettings(id, data);
    return jsonOk(customer);
  } catch (error) {
    return handleApiError(error);
  }
}
