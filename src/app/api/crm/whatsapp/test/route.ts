import { auth, requireAdmin } from "@/lib/auth";
import { sendTestWhatsApp } from "@/lib/whatsapp";
import { getWhatsAppConfig, getWhatsAppStatus } from "@/lib/whatsapp-config";
import { handleApiError, jsonOk, jsonError } from "@/lib/api-utils";
import { z } from "zod";

const testSchema = z.object({
  to: z.string().min(10, "Enter a valid phone number"),
});

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) return jsonError("Unauthorized", 401);

    const config = await getWhatsAppConfig();
    return jsonOk(getWhatsAppStatus(config));
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    await requireAdmin();
    const body = await request.json().catch(() => ({}));
    const { to } = testSchema.parse(body);

    const result = await sendTestWhatsApp(to);
    if (!result.success) {
      return jsonError(result.error || "Failed to send test WhatsApp", 400);
    }

    return jsonOk({ success: true, sentTo: to, whatsappLogId: result.whatsappLogId });
  } catch (error) {
    return handleApiError(error);
  }
}
