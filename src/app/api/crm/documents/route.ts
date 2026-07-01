import { auth } from "@/lib/auth";
import { handleApiError, jsonError, jsonOk } from "@/lib/api-utils";
import { listDocuments, type DocumentCategory } from "@/lib/services/document-list.service";

const CATEGORIES: DocumentCategory[] = ["all", "flight-ticket", "hotel-voucher", "bus-ticket", "invoice"];

export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) return jsonError("Unauthorized", 401);

    const { searchParams } = new URL(request.url);
    const categoryParam = searchParams.get("category") || "all";
    const category = CATEGORIES.includes(categoryParam as DocumentCategory)
      ? (categoryParam as DocumentCategory)
      : "all";

    const documents = await listDocuments({
      category,
      bookingRef: searchParams.get("bookingRef") || undefined,
      passenger: searchParams.get("passenger") || undefined,
      from: searchParams.get("from") || undefined,
      to: searchParams.get("to") || undefined,
      limit: parseInt(searchParams.get("limit") || "100", 10),
    });

    return jsonOk({ documents, category });
  } catch (error) {
    return handleApiError(error);
  }
}
