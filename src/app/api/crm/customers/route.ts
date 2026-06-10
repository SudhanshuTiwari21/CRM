import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { customerSchema } from "@/lib/validators/booking";
import { handleApiError, jsonOk, jsonError } from "@/lib/api-utils";
import type { Prisma } from "@prisma/client";

export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) return jsonError("Unauthorized", 401);

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || "";
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "20", 10);

    const where: Prisma.CustomerWhereInput = search
      ? {
          OR: [
            { name: { contains: search, mode: "insensitive" } },
            { phone: { contains: search } },
            { email: { contains: search, mode: "insensitive" } },
          ],
        }
      : {};

    const [customers, total] = await Promise.all([
      prisma.customer.findMany({
        where,
        include: {
          _count: { select: { bookings: true } },
          bookings: {
            select: { totalAmount: true, paymentStatus: true },
          },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.customer.count({ where }),
    ]);

    const enriched = customers.map((c) => ({
      ...c,
      totalBookings: c._count.bookings,
      lifetimeValue: c.bookings
        .filter((b) => b.paymentStatus === "PAID")
        .reduce((sum, b) => sum + Number(b.totalAmount), 0),
      bookings: undefined,
      _count: undefined,
    }));

    return jsonOk({ customers: enriched, total, page, limit });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) return jsonError("Unauthorized", 401);

    const body = await request.json();
    const data = customerSchema.parse(body);

    const customer = await prisma.customer.create({
      data: {
        name: data.name,
        email: data.email || null,
        phone: data.phone,
        gstin: data.gstin,
        address: data.address,
      },
    });

    return jsonOk(customer, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
