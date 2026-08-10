import { auth, requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { handleApiError, jsonOk, jsonError } from "@/lib/api-utils";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) return jsonError("Unauthorized", 401);

    const [agency, templates, users] = await Promise.all([
      prisma.agencySettings.findUnique({ where: { id: "default" } }),
      prisma.emailTemplate.findMany(),
      session.user.role === "ADMIN"
        ? prisma.user.findMany({
            select: { id: true, name: true, email: true, role: true, active: true, createdAt: true },
            orderBy: { createdAt: "desc" },
          })
        : prisma.user.findMany({
            where: { active: true },
            select: { id: true, name: true, active: true },
            orderBy: { name: "asc" },
          }),
    ]);

    return jsonOk({ agency, templates, users });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: Request) {
  try {
    await requireAdmin();
    const body = await request.json();
    const { agency, templates } = body;

    if (agency) {
      await prisma.agencySettings.upsert({
        where: { id: "default" },
        update: agency,
        create: { id: "default", ...agency },
      });
    }

    if (templates && Array.isArray(templates)) {
      for (const t of templates) {
        await prisma.emailTemplate.update({
          where: { key: t.key },
          data: { subject: t.subject, body: t.body },
        });
      }
    }

    return jsonOk({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
