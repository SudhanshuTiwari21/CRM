import { auth, requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { handleApiError, jsonOk, jsonError } from "@/lib/api-utils";
import { getActiveDbBrand, getAgencySettings } from "@/lib/brand-context";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) return jsonError("Unauthorized", 401);

    const brandId = await getActiveDbBrand();
    const [agency, templates, users] = await Promise.all([
      getAgencySettings(),
      prisma.emailTemplate.findMany({ where: { brandId } }),
      session.user.role === "ADMIN"
        ? prisma.user.findMany({
            where: { brandId },
            select: { id: true, name: true, email: true, role: true, active: true, createdAt: true },
            orderBy: { createdAt: "desc" },
          })
        : prisma.user.findMany({
            where: { brandId, active: true },
            select: { id: true, name: true, active: true },
            orderBy: { name: "asc" },
          }),
    ]);

    return jsonOk({ agency, templates, users, brandId });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: Request) {
  try {
    await requireAdmin();
    const body = await request.json();
    const { agency, templates } = body;
    const brandId = await getActiveDbBrand();

    if (agency) {
      const { id: _id, brandId: _b, ...safeAgency } = agency as Record<string, unknown>;
      await prisma.agencySettings.upsert({
        where: { brandId },
        update: safeAgency,
        create: { brandId, companyName: "Book to Roam", ...safeAgency },
      });
    }

    if (templates && Array.isArray(templates)) {
      for (const t of templates) {
        await prisma.emailTemplate.upsert({
          where: { brandId_key: { brandId, key: t.key } },
          update: { subject: t.subject, body: t.body },
          create: {
            brandId,
            key: t.key,
            subject: t.subject,
            body: t.body,
          },
        });
      }
    }

    return jsonOk({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
