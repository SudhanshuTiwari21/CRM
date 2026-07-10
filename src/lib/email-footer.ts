/** Social profiles for Book to Roam - update URLs when official pages are available. */
export const BOOKTOROAM_SOCIAL_LINKS = [
  {
    label: "Facebook",
    href: "https://www.facebook.com/booktoroam",
    bg: "#1877F2",
    icon: "f",
    fontSize: "18px",
  },
  {
    label: "Instagram",
    href: "https://www.instagram.com/booktoroam",
    bg: "#E4405F",
    icon: "Ig",
    fontSize: "12px",
  },
  {
    label: "YouTube",
    href: "https://www.youtube.com/@booktoroam",
    bg: "#FF0000",
    icon: "▶",
    fontSize: "14px",
  },
  {
    label: "WhatsApp",
    href: "https://wa.me/919874133113",
    bg: "#25D366",
    icon: "W",
    fontSize: "16px",
  },
] as const;

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function buildEmailSocialButtonsHtml(options?: {
  headingColor?: string;
  heading?: string;
}) {
  const headingColor = options?.headingColor ?? "#0f294d";
  const heading = options?.heading ?? "Follow us";

  const buttons = BOOKTOROAM_SOCIAL_LINKS.map(
    (link) => `
      <td style="padding:0 8px;">
        <a
          href="${link.href}"
          title="${escapeHtml(link.label)}"
          style="display:inline-block;width:40px;height:40px;line-height:40px;border-radius:50%;background:${link.bg};color:#ffffff;font-size:${link.fontSize};font-weight:700;text-decoration:none;text-align:center;font-family:Arial,Helvetica,sans-serif;"
        >${link.icon}</a>
      </td>`
  ).join("");

  return `
    <table width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0 8px;">
      <tr>
        <td align="center" style="padding-bottom:12px;font-size:14px;font-weight:600;color:${headingColor};font-family:Arial,Helvetica,sans-serif;">
          ${escapeHtml(heading)}
        </td>
      </tr>
      <tr>
        <td align="center">
          <table cellpadding="0" cellspacing="0" align="center">
            <tr>${buttons}</tr>
          </table>
        </td>
      </tr>
    </table>`;
}

export function buildEmailCopyrightHtml(
  companyName: string,
  options?: { mutedColor?: string; paddingBottom?: string }
) {
  const year = new Date().getFullYear();
  const mutedColor = options?.mutedColor ?? "#5f6b7a";
  const paddingBottom = options?.paddingBottom ?? "16px";

  return `
    <p style="margin:16px 0 0;padding:0 0 ${paddingBottom};text-align:center;font-size:12px;color:${mutedColor};line-height:1.6;font-family:Arial,Helvetica,sans-serif;">
      Copyright &copy; ${year} ${escapeHtml(companyName)}. All rights reserved.
    </p>`;
}
