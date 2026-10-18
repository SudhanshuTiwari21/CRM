import { prisma } from "@/lib/db";
import { getActiveDbBrand } from "@/lib/brand-context";
import type { ActivityInput } from "@/lib/validators/activity";

async function brandFilter() {
  return getActiveDbBrand();
}

export async function listActivities(params?: { city?: string; search?: string; activeOnly?: boolean }) {
  const brandId = await brandFilter();
  return prisma.activity.findMany({
    where: {
      brandId,
      ...(params?.activeOnly ? { active: true } : {}),
      ...(params?.city ? { city: { equals: params.city, mode: "insensitive" } } : {}),
      ...(params?.search
        ? {
            OR: [
              { name: { contains: params.search, mode: "insensitive" } },
              { city: { contains: params.search, mode: "insensitive" } },
              { tag: { contains: params.search, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    orderBy: [{ city: "asc" }, { name: "asc" }],
  });
}

export async function getActivityById(id: string) {
  const brandId = await brandFilter();
  return prisma.activity.findFirst({ where: { id, brandId } });
}

export async function createActivity(input: ActivityInput) {
  const brandId = await brandFilter();
  return prisma.activity.create({
    data: {
      brandId,
      city: input.city.trim(),
      country: input.country?.trim() || null,
      name: input.name.trim(),
      description: input.description?.trim() || null,
      tag: input.tag?.trim() || null,
      startTimes: input.startTimes?.trim() || null,
      duration: input.duration?.trim() || null,
      costPrice: input.costPrice ?? 0,
      sellPrice: input.sellPrice ?? 0,
      active: input.active ?? true,
    },
  });
}

export async function updateActivity(id: string, input: Partial<ActivityInput>) {
  const existing = await getActivityById(id);
  if (!existing) throw new Error("Activity not found");
  return prisma.activity.update({
    where: { id },
    data: {
      ...(input.city !== undefined ? { city: input.city.trim() } : {}),
      ...(input.country !== undefined ? { country: input.country?.trim() || null } : {}),
      ...(input.name !== undefined ? { name: input.name.trim() } : {}),
      ...(input.description !== undefined ? { description: input.description?.trim() || null } : {}),
      ...(input.tag !== undefined ? { tag: input.tag?.trim() || null } : {}),
      ...(input.startTimes !== undefined ? { startTimes: input.startTimes?.trim() || null } : {}),
      ...(input.duration !== undefined ? { duration: input.duration?.trim() || null } : {}),
      ...(input.costPrice !== undefined ? { costPrice: input.costPrice } : {}),
      ...(input.sellPrice !== undefined ? { sellPrice: input.sellPrice } : {}),
      ...(input.active !== undefined ? { active: input.active } : {}),
    },
  });
}

export async function deleteActivity(id: string) {
  const existing = await getActivityById(id);
  if (!existing) throw new Error("Activity not found");
  await prisma.activity.delete({ where: { id } });
  return { ok: true };
}
