import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { createCustomerSchema } from "@/lib/validators/customer";
import { createCustomerRecord, customerListInclude } from "@/lib/services/customer.service";
import { handleApiError, jsonOk, jsonError } from "@/lib/api-utils";
import { getActiveDbBrand } from "@/lib/brand-context";
import type { Prisma } from "@prisma/client";
import { CASH_WALK_IN_PHONE } from "@/lib/cash-customer";

export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) return jsonError("Unauthorized", 401);

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || "";
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "20", 10);

    const brandId = await getActiveDbBrand();
    const where: Prisma.CustomerWhereInput = {
      brandId,
      phone: { not: CASH_WALK_IN_PHONE },
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: "insensitive" } },
              { phone: { contains: search } },
              { email: { contains: search, mode: "insensitive" } },
              { pan: { contains: search, mode: "insensitive" } },
              { gstin: { contains: search, mode: "insensitive" } },
            ],
          }
        : {}),
    };

    const [customers, total] = await Promise.all([
      prisma.customer.findMany({
        where,
        include: customerListInclude(),
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
    const data = createCustomerSchema.parse(body);
    const isAdmin = session.user.role === "ADMIN";
    const customer = await createCustomerRecord(data, { creditLimitAllowed: isAdmin });

    return jsonOk(customer, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
