import { auth } from "@/lib/auth";
import { listHotelProfiles } from "@/lib/services/hotel.service";
import { hotelProfileSchema } from "@/lib/validators/hotel";
import { handleApiError, jsonOk, jsonError } from "@/lib/api-utils";
import { upsertHotelProfile } from "@/lib/services/hotel.service";

export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) return jsonError("Unauthorized", 401);

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || undefined;
    const hotels = await listHotelProfiles(search);
    return jsonOk(hotels);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) return jsonError("Unauthorized", 401);

    const body = await request.json();
    const input = hotelProfileSchema.parse(body);
    const hotel = await upsertHotelProfile(input);
    return jsonOk(hotel, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
