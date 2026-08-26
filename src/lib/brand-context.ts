import { cookies } from "next/headers";
import type { CrmBrand } from "@prisma/client";
import {
  BRAND_STORAGE_KEY,
  getBrandPreset,
  isBrandId,
  type BrandId,
} from "@/lib/branding";
import { prisma } from "@/lib/db";

export const BRAND_COOKIE = BRAND_STORAGE_KEY;

export function toDbBrand(brandId: BrandId): CrmBrand {
  return brandId === "techrecoil" ? "TECHRECOIL" : "BOOK_TO_ROAM";
}

export function fromDbBrand(brand: CrmBrand | string | null | undefined): BrandId {
  if (brand === "TECHRECOIL" || brand === "techrecoil") return "techrecoil";
  return "book-to-roam";
}

export async function getActiveBrandId(): Promise<BrandId> {
  try {
    const jar = await cookies();
    const value = jar.get(BRAND_COOKIE)?.value;
    if (isBrandId(value)) return value;
  } catch {
    // cookies() can throw outside a request context
  }
  return "book-to-roam";
}

export async function getActiveDbBrand(): Promise<CrmBrand> {
  return toDbBrand(await getActiveBrandId());
}

/** Agency settings for the active brand (or a specific brand). */
export async function getAgencySettings(brandId?: BrandId) {
  const id = brandId ?? (await getActiveBrandId());
  const dbBrand = toDbBrand(id);
  const existing = await prisma.agencySettings.findUnique({
    where: { brandId: dbBrand },
  });
  if (existing) return existing;

  const preset = getBrandPreset(id);
  return prisma.agencySettings.create({
    data: {
      brandId: dbBrand,
      companyName: preset.companyName,
      logoUrl: preset.logoSrc,
      invoicePrefix: id === "techrecoil" ? "TR" : "INV",
      webhookApiKey: process.env.WEBHOOK_API_KEY || "dev-webhook-key-change-me",
    },
  });
}

export function brandScope(brandId?: CrmBrand) {
  return { brandId: brandId as CrmBrand };
}
