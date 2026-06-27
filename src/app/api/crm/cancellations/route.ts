import { auth } from "@/lib/auth";
import { listCancellations } from "@/lib/services/cancellation.service";
import { handleApiError, jsonOk, jsonError } from "@/lib/api-utils";
import type { CancellationCategory, ProductType } from "@prisma/client";

export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) return jsonError("Unauthorized", 401);

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "20", 10);
    const category = searchParams.get("category") as CancellationCategory | null;
    const productType = searchParams.get("productType") as ProductType | null;
    const search = searchParams.get("search") || "";

    const result = await listCancellations({
      page,
      limit,
      category: category || undefined,
      productType: productType === "FLIGHT" || productType === "HOTEL" ? productType : undefined,
      search: search || undefined,
    });

    return jsonOk(result);
  } catch (error) {
    return handleApiError(error);
  }
}
