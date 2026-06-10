import { auth, requireAdmin } from "@/lib/auth";
import { sendTestEmail } from "@/lib/mailer";
import { getSmtpConfig, getSmtpStatus } from "@/lib/smtp-config";
import { handleApiError, jsonOk, jsonError } from "@/lib/api-utils";
import { z } from "zod";

const testSchema = z.object({
  to: z.string().email().optional(),
});

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) return jsonError("Unauthorized", 401);

    const config = await getSmtpConfig();
    return jsonOk(getSmtpStatus(config));
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireAdmin();
    const body = await request.json().catch(() => ({}));
    const { to } = testSchema.parse(body);

    const recipient = to || session.user.email;
    const result = await sendTestEmail(recipient);

    if (!result.success) {
      return jsonError(result.error || "Failed to send test email", 400);
    }

    return jsonOk({ success: true, sentTo: recipient, emailLogId: result.emailLogId });
  } catch (error) {
    return handleApiError(error);
  }
}
