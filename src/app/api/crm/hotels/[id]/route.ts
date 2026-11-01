import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getHotelProfile } from "@/lib/services/hotel.service";
import { hotelProfileUpdateSchema } from "@/lib/validators/hotel";
import { handleApiError, jsonOk, jsonError } from "@/lib/api-utils";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session?.user) return jsonError("Unauthorized", 401);

    const { id } = await params;
    const hotel = await getHotelProfile(id);
    if (!hotel) return jsonError("Hotel not found", 404);
    return jsonOk(hotel);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session?.user) return jsonError("Unauthorized", 401);

    const { id } = await params;
    const existing = await prisma.hotelProfile.findUnique({ where: { id } });
    if (!existing) return jsonError("Hotel not found", 404);

    const body = await request.json();
    const input = hotelProfileUpdateSchema.parse(body);

    if (input.name && input.name.trim() !== existing.name) {
      const clash = await prisma.hotelProfile.findUnique({
        where: { name: input.name.trim() },
      });
      if (clash) return jsonError("Another hotel already uses this name", 400);
    }

    const hotel = await prisma.hotelProfile.update({
      where: { id },
      data: {
        ...input,
        name: input.name?.trim(),
        address: input.address?.trim(),
        city: input.city?.trim() || null,
        phone: input.phone?.trim() || null,
        email: input.email?.trim() || null,
      },
    });
    return jsonOk(hotel);
  } catch (error) {
    return handleApiError(error);
  }
}
