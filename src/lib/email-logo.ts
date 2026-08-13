import fs from "fs/promises";
import path from "path";
import type { EmailAttachment } from "@/lib/mailer";
import { prisma } from "@/lib/db";
import { brandFromCompanyName, brandUsesSquareLogo, getBrandPreset } from "@/lib/branding";

export const EMAIL_LOGO_CID = "agency-logo@crm";

function escapeAttr(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;");
}

/** CID reference for inline logo - works in Gmail, Apple Mail, Outlook (unlike data: URIs). */
export function getEmailLogoSrc() {
  return `cid:${EMAIL_LOGO_CID}`;
}

export async function getEmailLogoInlineAttachment(): Promise<EmailAttachment> {
  let fileName = "booktoroam-logo.png";
  try {
    const agency = await prisma.agencySettings.findUnique({
      where: { id: "default" },
      select: { companyName: true },
    });
    fileName = getBrandPreset(brandFromCompanyName(agency?.companyName)).pdfLogoFile;
  } catch {
    // Keep Book to Roam fallback.
  }

  const pngPath = path.join(process.cwd(), "public", fileName);
  const content = await fs.readFile(pngPath);
  return {
    filename: fileName,
    content,
    contentType: "image/png",
    cid: EMAIL_LOGO_CID,
  };
}

export function emailLogoImgHtml(companyName: string, logoSrc: string | null) {
  if (!logoSrc) return "";
  const alt = escapeAttr(companyName);
  if (brandUsesSquareLogo(companyName)) {
    return `<img src="${logoSrc}" alt="${alt}" width="64" height="64" style="display:block;width:64px;height:64px;object-fit:cover;border-radius:8px;" />`;
  }
  return `<img src="${logoSrc}" alt="${alt}" width="140" height="26" style="display:block;max-width:140px;height:auto;" />`;
}

/** Shared responsive rules for flight confirmation emails. */
export function emailResponsiveStyles() {
  return `<style type="text/css">
    body { margin: 0 !important; padding: 0 !important; width: 100% !important; -webkit-text-size-adjust: 100%; }
    table { border-collapse: collapse; mso-table-lspace: 0; mso-table-rspace: 0; }
    img { border: 0; outline: none; text-decoration: none; max-width: 100%; height: auto; display: block; }
    .email-container { max-width: 600px !important; width: 100% !important; }
    @media only screen and (max-width: 620px) {
      .email-outer-pad { padding: 12px 8px !important; }
      .email-container { padding: 16px 12px !important; }
      .col-quarter, .col-third, .col-half { display: block !important; width: 100% !important; max-width: 100% !important; padding-right: 0 !important; box-sizing: border-box !important; }
      .text-right-sm, .text-right-sm * { text-align: left !important; }
      .header-contact { text-align: left !important; padding-top: 10px !important; width: 100% !important; display: block !important; }
      .header-logo-cell { width: 100% !important; display: block !important; }
    }
  </style>`;
}
