import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { customerSchema } from "@/lib/validators/booking";
import { handleApiError, jsonOk, jsonError } from "@/lib/api-utils";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session?.user) return jsonError("Unauthorized", 401);

    const { id } = await params;

    const customer = await prisma.customer.findUnique({
      where: { id },
      include: {
        bookings: {
          include: {
            assignedAgent: { select: { name: true } },
          },
          orderBy: { createdAt: "desc" },
        },
      },
    });

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
    const data = customerSchema.parse(body);

    const customer = await prisma.customer.update({
      where: { id },
      data: {
        name: data.name,
        email: data.email || null,
        phone: data.phone,
        gstin: data.gstin,
        address: data.address,
      },
    });

    return jsonOk(customer);
  } catch (error) {
    return handleApiError(error);
  }
}
