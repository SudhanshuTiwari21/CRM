import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { logActivity } from "@/lib/services/activity.service";
import { handleApiError, jsonOk, jsonError } from "@/lib/api-utils";
import { z } from "zod";

const schema = z.object({
  agentId: z.string().min(1),
});

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session?.user) return jsonError("Unauthorized", 401);

    const { id } = await params;
    const { agentId } = schema.parse(await request.json());

    const agent = await prisma.user.findFirst({
      where: { id: agentId, active: true },
    });
    if (!agent) return jsonError("Agent not found", 404);

    const booking = await prisma.booking.update({
      where: { id },
      data: { assignedAgentId: agentId },
      include: { assignedAgent: { select: { name: true } } },
    });

    await logActivity({
      bookingId: id,
      userId: session.user.id,
      action: "AGENT_ASSIGNED",
      details: { agentId, agentName: agent.name },
    });

    return jsonOk(booking);
  } catch (error) {
    return handleApiError(error);
  }
}
