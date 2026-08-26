import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { handleApiError, jsonOk, jsonError } from "@/lib/api-utils";
import { getActiveDbBrand } from "@/lib/brand-context";

export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) return jsonError("Unauthorized", 401);

    const { searchParams } = new URL(request.url);
    const q = searchParams.get("q") || "";
    if (q.length < 2) return jsonOk({ bookings: [], customers: [], leads: [] });

    const brandId = await getActiveDbBrand();

    const [bookings, customers, leads] = await Promise.all([
      prisma.booking.findMany({
        where: {
          brandId,
          OR: [
            { publicRef: { contains: q, mode: "insensitive" } },
            { pnr: { contains: q, mode: "insensitive" } },
          ],
        },
        include: { customer: { select: { name: true } } },
        take: 5,
      }),
      prisma.customer.findMany({
        where: {
          brandId,
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { phone: { contains: q } },
          ],
        },
        take: 5,
      }),
      prisma.lead.findMany({
        where: {
          brandId,
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { phone: { contains: q } },
            { company: { contains: q, mode: "insensitive" } },
            { queryRef: { contains: q, mode: "insensitive" } },
            { destinations: { contains: q, mode: "insensitive" } },
          ],
        },
        take: 5,
      }),
    ]);

    return jsonOk({ bookings, customers, leads });
  } catch (error) {
    return handleApiError(error);
  }
}
