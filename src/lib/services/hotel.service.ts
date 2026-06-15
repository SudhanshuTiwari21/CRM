import { prisma } from "@/lib/db";
import type { Prisma } from "@prisma/client";

export interface HotelProfileInput {
  name: string;
  address: string;
  city?: string;
  phone?: string;
  email?: string;
  checkInTime?: string;
  checkOutTime?: string;
}

export async function upsertHotelProfile(input: HotelProfileInput) {
  const normalizedName = input.name.trim();

  return prisma.hotelProfile.upsert({
    where: { name: normalizedName },
    update: {
      address: input.address,
      city: input.city,
      phone: input.phone,
      email: input.email || undefined,
      checkInTime: input.checkInTime || "02:00 PM",
      checkOutTime: input.checkOutTime || "12:00 PM",
    },
    create: {
      name: normalizedName,
      address: input.address,
      city: input.city,
      phone: input.phone,
      email: input.email || undefined,
      checkInTime: input.checkInTime || "02:00 PM",
      checkOutTime: input.checkOutTime || "12:00 PM",
    },
  });
}

export async function findHotelProfileByName(name: string) {
  return prisma.hotelProfile.findUnique({
    where: { name: name.trim() },
  });
}

export async function listHotelProfiles(search?: string) {
  const where: Prisma.HotelProfileWhereInput = search
    ? {
        OR: [
          { name: { contains: search, mode: "insensitive" } },
          { city: { contains: search, mode: "insensitive" } },
        ],
      }
    : {};

  return prisma.hotelProfile.findMany({
    where,
    orderBy: { name: "asc" },
    include: { _count: { select: { hotelBookings: true } } },
  });
}

export async function getHotelProfile(id: string) {
  return prisma.hotelProfile.findUnique({
    where: { id },
    include: {
      hotelBookings: {
        take: 10,
        orderBy: { booking: { createdAt: "desc" } },
        include: {
          booking: {
            select: {
              id: true,
              publicRef: true,
              status: true,
              createdAt: true,
              customer: { select: { name: true } },
            },
          },
        },
      },
      _count: { select: { hotelBookings: true } },
    },
  });
}
