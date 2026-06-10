import { prisma } from "@/lib/db";

export async function generatePublicRef(): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `FB-${year}-`;

  const lastBooking = await prisma.booking.findFirst({
    where: { publicRef: { startsWith: prefix } },
    orderBy: { publicRef: "desc" },
    select: { publicRef: true },
  });

  let nextNum = 1;
  if (lastBooking) {
    const lastNum = parseInt(lastBooking.publicRef.replace(prefix, ""), 10);
    if (!isNaN(lastNum)) nextNum = lastNum + 1;
  }

  return `${prefix}${String(nextNum).padStart(6, "0")}`;
}
