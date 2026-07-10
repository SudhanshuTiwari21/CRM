import { auth } from "@/lib/auth";
import { recordHubPayment, listPaymentHistory } from "@/lib/services/payments-hub.service";
import { recordPaymentSchema } from "@/lib/validators/payments-hub";
import { handleApiError, jsonError, jsonOk } from "@/lib/api-utils";
import type { BillingType } from "@prisma/client";

export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) return jsonError("Unauthorized", 401);

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "30", 10);
    const billingType = searchParams.get("billingType") as BillingType | null;

    const result = await listPaymentHistory({
      page,
      limit,
      billingType: billingType === "CASH" || billingType === "LEDGER" ? billingType : undefined,
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
    const data = recordPaymentSchema.parse(body);
    const result = await recordHubPayment(data, session.user.id);
    return jsonOk(result);
  } catch (error) {
    return handleApiError(error);
  }
}
