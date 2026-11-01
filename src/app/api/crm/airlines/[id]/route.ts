import { auth } from "@/lib/auth";
import { getAirlineProfile, updateAirlineProfile } from "@/lib/services/airline.service";
import { airlineProfileUpdateSchema } from "@/lib/validators/airline";
import { handleApiError, jsonOk, jsonError } from "@/lib/api-utils";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session?.user) return jsonError("Unauthorized", 401);

    const { id } = await params;
    const airline = await getAirlineProfile(id);
    if (!airline) return jsonError("Airline not found", 404);
    return jsonOk(airline);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session?.user) return jsonError("Unauthorized", 401);

    const { id } = await params;
    const body = await request.json();
    const input = airlineProfileUpdateSchema.parse(body);

    const airline = await updateAirlineProfile(id, {
      name: input.name,
      iataCode: input.iataCode === undefined ? undefined : input.iataCode || null,
      logoUrl: input.logoUrl === undefined ? undefined : input.logoUrl || null,
    });
    return jsonOk(airline);
  } catch (error) {
    return handleApiError(error);
  }
}
