import { auth } from "@/lib/auth";
import { findAirlineProfileByName } from "@/lib/services/airline.service";
import { getAirlineLogoUrl } from "@/lib/airline-logo";
import { handleApiError, jsonOk, jsonError } from "@/lib/api-utils";

export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) return jsonError("Unauthorized", 401);

    const { searchParams } = new URL(request.url);
    const name = searchParams.get("name")?.trim();
    if (!name) return jsonError("name is required", 400);

    const profile = await findAirlineProfileByName(name);
    if (profile) {
      return jsonOk({
        found: true,
        name: profile.name,
        iataCode: profile.iataCode,
        logoUrl: profile.logoUrl || getAirlineLogoUrl(profile.name),
      });
    }

    return jsonOk({
      found: false,
      logoUrl: getAirlineLogoUrl(name),
    });
  } catch (error) {
    return handleApiError(error);
  }
}
