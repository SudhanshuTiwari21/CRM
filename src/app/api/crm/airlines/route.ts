import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { listAirlineProfiles } from "@/lib/services/airline.service";
import { handleApiError, jsonError } from "@/lib/api-utils";

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
