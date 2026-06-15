import { auth } from "@/lib/auth";
import { findHotelProfileByName } from "@/lib/services/hotel.service";
import { handleApiError, jsonOk, jsonError } from "@/lib/api-utils";

export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) return jsonError("Unauthorized", 401);

    const { searchParams } = new URL(request.url);
    const name = searchParams.get("name");
    if (!name) return jsonError("name is required", 400);

    const hotel = await findHotelProfileByName(name);
    if (!hotel) return jsonOk({ found: false });

    return jsonOk({
      found: true,
      id: hotel.id,
      name: hotel.name,
      address: hotel.address,
      city: hotel.city,
      phone: hotel.phone,
      email: hotel.email,
      checkInTime: hotel.checkInTime,
      checkOutTime: hotel.checkOutTime,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
