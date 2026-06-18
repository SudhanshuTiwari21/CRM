import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { handleApiError, jsonOk, jsonError } from "@/lib/api-utils";

export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) return jsonError("Unauthorized", 401);

    const phone = new URL(request.url).searchParams.get("phone")?.trim();
    if (!phone || phone.length < 10) {
      return jsonError("Phone number required", 400);
    }

    const customer = await prisma.customer.findFirst({
      where: { phone },
      select: {
        id: true,
        name: true,
        type: true,
        creditEnabled: true,
        creditLimit: true,
        creditBalance: true,
        paymentTermsDays: true,
      },
    });

    return jsonOk({ customer });
  } catch (error) {
    return handleApiError(error);
  }
}
