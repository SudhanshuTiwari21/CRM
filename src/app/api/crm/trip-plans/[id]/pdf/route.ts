import { auth } from "@/lib/auth";
import { generateTripPlanPdf, tripPlanPdfFileName } from "@/lib/services/trip-plan-pdf.service";
import { getTripPlanById } from "@/lib/services/trip-plan.service";
import { handleApiError, jsonError } from "@/lib/api-utils";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session?.user) return jsonError("Unauthorized", 401);

    const { id } = await params;
    const plan = await getTripPlanById(id);
    const { buffer, fileName } = await generateTripPlanPdf(id);
    const downloadName =
      fileName || tripPlanPdfFileName(plan.lead.queryRef, plan.leadId, plan.version);

    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${downloadName}"`,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
