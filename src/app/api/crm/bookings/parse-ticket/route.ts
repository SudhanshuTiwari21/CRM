import { auth } from "@/lib/auth";
import { handleApiError, jsonOk, jsonError } from "@/lib/api-utils";
import { parseUploadedTicket } from "@/lib/services/ticket-upload.service";
import type { ParsedProductType } from "@/lib/services/ticket-parse.service";

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) return jsonError("Unauthorized", 401);

    const formData = await request.formData();
    const file = formData.get("file");
    const productHintRaw = String(formData.get("productHint") || "").toUpperCase();
    const productHint = (["FLIGHT", "HOTEL", "BUS"].includes(productHintRaw)
      ? productHintRaw
      : undefined) as ParsedProductType | undefined;

    if (!(file instanceof File)) {
      return jsonError("Upload a ticket PDF or image file", 400);
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const result = await parseUploadedTicket({
      buffer,
      mimeType: file.type || "application/pdf",
      fileName: file.name || "ticket.pdf",
      productHint,
    });

    return jsonOk(result);
  } catch (error) {
    return handleApiError(error);
  }
}
