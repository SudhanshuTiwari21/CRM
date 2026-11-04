import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { listAirlineProfiles, upsertAirlineProfile } from "@/lib/services/airline.service";
import { airlineProfileSchema } from "@/lib/validators/airline";
import { handleApiError, jsonError, jsonOk } from "@/lib/api-utils";

export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) return jsonError("Unauthorized", 401);

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || undefined;
    const airlines = await listAirlineProfiles(search);
    return NextResponse.json({ airlines });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) return jsonError("Unauthorized", 401);

    const body = await request.json();
    const input = airlineProfileSchema.parse(body);
    const airline = await upsertAirlineProfile({
      name: input.name,
      iataCode: input.iataCode || undefined,
      logoUrl: input.logoUrl || undefined,
    });
    return jsonOk(airline, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
