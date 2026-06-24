import { processCheckInAssistanceReminders } from "@/lib/services/checkin-assistance.service";
import { jsonError, jsonOk } from "@/lib/api-utils";

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return jsonError("Unauthorized", 401);
  }

  try {
    const result = await processCheckInAssistanceReminders();
    return jsonOk(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Cron failed";
    return jsonError(message, 500);
  }
}
