export type BrandId = "book-to-roam" | "techrecoil";

export interface BrandPreset {
  id: BrandId;
  label: string;
  shortLabel: string;
  companyName: string;
  logoSrc: string;
  /** PNG used on PDF invoices/vouchers when available */
  pdfLogoFile: string;
  heroTagline: string;
}

export const BRAND_STORAGE_KEY = "crm-active-brand";

export const BRAND_PRESETS: Record<BrandId, BrandPreset> = {
  "book-to-roam": {
    id: "book-to-roam",
    label: "Book to Roam",
    shortLabel: "BTR",
    companyName: "Book to Roam",
    logoSrc: "/booktoroam-logo.svg",
    pdfLogoFile: "booktoroam-logo.png",
    heroTagline: "Book to Roam · Operations Hub",
  },
  techrecoil: {
    id: "techrecoil",
    label: "TechRecoil",
    shortLabel: "TR",
    companyName: "TechRecoil",
    logoSrc: "/techrecoil-logo.svg",
    pdfLogoFile: "techrecoil-logo.png",
    heroTagline: "TechRecoil · Operations Hub",
  },
};

export const BRAND_OPTIONS = [BRAND_PRESETS["book-to-roam"], BRAND_PRESETS.techrecoil] as const;

export function isBrandId(value: unknown): value is BrandId {
  return value === "book-to-roam" || value === "techrecoil";
}

export function brandFromCompanyName(companyName?: string | null): BrandId {
  const name = (companyName || "").toLowerCase();
  if (name.includes("techrecoil") || name.includes("tech recoil")) return "techrecoil";
  return "book-to-roam";
}

export function getBrandPreset(id: BrandId): BrandPreset {
  return BRAND_PRESETS[id];
}
