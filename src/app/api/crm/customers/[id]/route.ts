import { auth } from "@/lib/auth";
import { createCustomerSchema } from "@/lib/validators/customer";
import { getCustomerWithRelations, updateCustomerRecord } from "@/lib/services/customer.service";
import { handleApiError, jsonOk, jsonError } from "@/lib/api-utils";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session?.user) return jsonError("Unauthorized", 401);

    const { id } = await params;
    const customer = await getCustomerWithRelations(id);
    if (!customer) return jsonError("Customer not found", 404);

    const lifetimeValue = customer.bookings
      .filter((b) => b.paymentStatus === "PAID")
      .reduce((sum, b) => sum + Number(b.totalAmount), 0);

    return jsonOk({ ...customer, lifetimeValue });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session?.user) return jsonError("Unauthorized", 401);

    const { id } = await params;
    const body = await request.json();
    const data = createCustomerSchema.parse(body);
    const customer = await updateCustomerRecord(id, data);

    return jsonOk(customer);
  } catch (error) {
    return handleApiError(error);
  }
}
