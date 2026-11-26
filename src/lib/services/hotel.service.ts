import { prisma } from "@/lib/db";
import type { Prisma } from "@prisma/client";
import { normalizeHotelEmails } from "@/lib/validators/hotel";

export interface HotelProfileInput {
  name: string;
  address: string;
  city?: string;
  country?: string;
  phone?: string;
  email?: string;
  emails?: string[];
  checkInTime?: string;
  checkOutTime?: string;
}

export async function upsertHotelProfile(input: HotelProfileInput) {
  const normalizedName = input.name.trim();
  const existing = await prisma.hotelProfile.findUnique({
    where: { name: normalizedName },
  });

  let email: string | null;
  let emails: string[];

  if (input.emails !== undefined) {
    ({ email, emails } = normalizeHotelEmails({
      emails: input.emails,
      email: input.email,
    }));
  } else if (existing) {
    // Single-email booking path: keep 2nd/3rd emails already saved on the profile
    const existingList =
      existing.emails.length > 0
        ? existing.emails
        : existing.email
          ? [existing.email]
          : [];
    if (input.email?.trim()) {
      const primary = input.email.trim();
      const rest = existingList.filter((e) => e.toLowerCase() !== primary.toLowerCase());
      ({ email, emails } = normalizeHotelEmails({ emails: [primary, ...rest] }));
    } else {
      ({ email, emails } = normalizeHotelEmails({
        emails: existingList,
        email: existing.email,
      }));
    }
  } else {
    ({ email, emails } = normalizeHotelEmails({ email: input.email }));
  }

  return prisma.hotelProfile.upsert({
    where: { name: normalizedName },
    update: {
      address: input.address,
      city: input.city,
      country: input.country,
      phone: input.phone,
      email,
      emails,
      checkInTime: input.checkInTime || "02:00 PM",
      checkOutTime: input.checkOutTime || "12:00 PM",
    },
    create: {
      name: normalizedName,
      address: input.address,
      city: input.city,
      country: input.country,
      phone: input.phone,
      email,
      emails,
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
