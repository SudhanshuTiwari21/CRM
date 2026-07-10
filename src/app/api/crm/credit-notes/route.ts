import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { createCreditNote, listCreditNotes } from "@/lib/services/credit-note.service";
import { createCreditNoteSchema } from "@/lib/validators/payments-hub";
import { handleApiError, jsonError, jsonOk } from "@/lib/api-utils";

export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) return jsonError("Unauthorized", 401);

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "20", 10);
    const customerId = searchParams.get("customerId") || undefined;
    const search = searchParams.get("search") || undefined;

    const result = await listCreditNotes({ page, limit, customerId, search });
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
    const data = createCreditNoteSchema.parse(body);

    let bookingId = data.bookingId;
    if (!bookingId && data.bookingPublicRef) {
      const booking = await prisma.booking.findFirst({
        where: { publicRef: { equals: data.bookingPublicRef, mode: "insensitive" } },
        select: { id: true },
      });
      if (!booking) return jsonError(`Booking ${data.bookingPublicRef} not found`, 404);
      bookingId = booking.id;
    }

    const note = await createCreditNote({
      customerId: data.customerId,
      bookingId,
      amount: data.amount,
      billingType: data.billingType,
      reason: data.reason,
      notes: data.notes,
      source: "MANUAL",
      createdById: session.user.id,
    });
    return jsonOk(note);
  } catch (error) {
    return handleApiError(error);
  }
}
