import { prisma } from "@/lib/db";
import { handleApiError, jsonOk, jsonError } from "@/lib/api-utils";
import { validateWebhookApiKey } from "@/lib/api-utils";

export async function GET(request: Request, { params }: { params: Promise<{ publicRef: string }> }) {
  try {
    await validateWebhookApiKey(request);

    const { publicRef } = await params;

    const booking = await prisma.booking.findFirst({
      where: { publicRef },
      select: {
        publicRef: true,
        status: true,
        productType: true,
        pnr: true,
        paymentStatus: true,
        totalAmount: true,
        confirmedAt: true,
        createdAt: true,
      },
    });

    if (!booking) return jsonError("Booking not found", 404);
    return jsonOk(booking);
  } catch (error) {
    if (error instanceof Error && error.message === "Invalid API key") {
      return jsonError("Invalid API key", 401);
    }
    return handleApiError(error);
  }
}
