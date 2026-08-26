import { auth } from "@/lib/auth";
import { handleApiError, jsonOk, jsonError } from "@/lib/api-utils";
import { getBrandPreset, isBrandId } from "@/lib/branding";
import { BRAND_COOKIE, getAgencySettings, toDbBrand } from "@/lib/brand-context";
import { cookies } from "next/headers";

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) return jsonError("Unauthorized", 401);

    const body = await request.json();
    const brandId = body?.brandId;
    if (!isBrandId(brandId)) {
      return jsonError("Invalid brand", 400);
    }

    // Ensure this brand has its own settings row (does not overwrite the other brand).
    await getAgencySettings(brandId);

    const jar = await cookies();
    jar.set(BRAND_COOKIE, brandId, {
      path: "/",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 365,
    });

    const preset = getBrandPreset(brandId);
    return jsonOk({
      success: true,
      brandId,
      dbBrand: toDbBrand(brandId),
      companyName: preset.companyName,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
