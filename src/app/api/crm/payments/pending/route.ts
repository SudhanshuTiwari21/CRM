import { auth } from "@/lib/auth";
import { getPendingPayments } from "@/lib/services/pending-payments.service";
import { handleApiError, jsonError, jsonOk } from "@/lib/api-utils";
import type { BillingType } from "@prisma/client";

export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) return jsonError("Unauthorized", 401);

    const { searchParams } = new URL(request.url);
    const billingType = searchParams.get("billingType") as BillingType | null;
    const customerId = searchParams.get("customerId");

    const report = await getPendingPayments();

    if (billingType === "LEDGER") {
      let customers = report.ledger.customers;
      if (customerId) {
        customers = customers.filter((c) => c.customerId === customerId);
      }
      return jsonOk({
        billingType: "LEDGER",
        customers,
        bookings: customers.flatMap((c) => c.bookings),
      });
    }

    if (billingType === "CASH") {
      return jsonOk({
        billingType: "CASH",
        bookings: report.cash.bookings,
      });
    }

    return jsonOk(report);
  } catch (error) {
    return handleApiError(error);
  }
}
