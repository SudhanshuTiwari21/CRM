import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { handleApiError, jsonOk, jsonError } from "@/lib/api-utils";
import { getBrandPreset, isBrandId } from "@/lib/branding";

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) return jsonError("Unauthorized", 401);

    const body = await request.json();
    const brandId = body?.brandId;
    if (!isBrandId(brandId)) {
      return jsonError("Invalid brand", 400);
    }

    const preset = getBrandPreset(brandId);
    await prisma.agencySettings.upsert({
      where: { id: "default" },
      update: {
        companyName: preset.companyName,
        logoUrl: preset.logoSrc,
      },
      create: {
        id: "default",
        companyName: preset.companyName,
        logoUrl: preset.logoSrc,
      },
    });

    return jsonOk({ success: true, brandId, companyName: preset.companyName });
  } catch (error) {
    return handleApiError(error);
  }
}
