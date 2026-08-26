import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { createOfflineBooking } from "@/lib/services/booking.service";
import { offlineBookingSchema } from "@/lib/validators/booking";
import { handleApiError, jsonOk, jsonError } from "@/lib/api-utils";
import { getActiveDbBrand } from "@/lib/brand-context";
import type { BookingStatus, BookingChannel, ProductType, Prisma } from "@prisma/client";

export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) return jsonError("Unauthorized", 401);

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "20", 10);
    const status = searchParams.get("status") as BookingStatus | null;
    const channel = searchParams.get("channel") as BookingChannel | null;
    const productType = searchParams.get("productType") as ProductType | null;
    const search = searchParams.get("search") || "";
    const view = searchParams.get("view");

    const where: Prisma.BookingWhereInput = {
      brandId: await getActiveDbBrand(),
    };

    if (status) where.status = status;
    if (channel) where.channel = channel;
    if (productType) where.productType = productType;

    if (search) {
      where.OR = [
        { publicRef: { contains: search, mode: "insensitive" } },
        { pnr: { contains: search, mode: "insensitive" } },
        { customer: { name: { contains: search, mode: "insensitive" } } },
        { customer: { phone: { contains: search } } },
        { customer: { email: { contains: search, mode: "insensitive" } } },
      ];
    }

    if (view === "kanban") {
      const bookings = await prisma.booking.findMany({
        where,
        include: { customer: true, assignedAgent: { select: { name: true } } },
        orderBy: { createdAt: "desc" },
        take: 200,
      });
      return jsonOk({ bookings });
    }

    const [bookings, total] = await Promise.all([
      prisma.booking.findMany({
        where,
        include: {
          customer: true,
          assignedAgent: { select: { name: true } },
          flightBooking: true,
          hotelBooking: true,
          busBooking: true,
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.booking.count({ where }),
    ]);

    return jsonOk({ bookings, total, page, limit, totalPages: Math.ceil(total / limit) });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) return jsonError("Unauthorized", 401);

    const body = await request.json();
    const input = offlineBookingSchema.parse(body);
    const booking = await createOfflineBooking(input, session.user.id);

    return jsonOk(booking, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
