import fs from "fs/promises";
import path from "path";
import type { EmailAttachment } from "@/lib/mailer";

export const EMAIL_LOGO_CID = "booktoroam-logo@booktoroam";

/** CID reference for inline logo - works in Gmail, Apple Mail, Outlook (unlike data: URIs). */
export function getEmailLogoSrc() {
  return `cid:${EMAIL_LOGO_CID}`;
}

export async function getEmailLogoInlineAttachment(): Promise<EmailAttachment> {
  const pngPath = path.join(process.cwd(), "public", "booktoroam-logo.png");
  const content = await fs.readFile(pngPath);
  return {
    filename: "booktoroam-logo.png",
    content,
    contentType: "image/png",
    cid: EMAIL_LOGO_CID,
  };
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
