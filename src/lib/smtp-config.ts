import { prisma } from "@/lib/db";
import { getAgencySettings } from "@/lib/brand-context";

export interface SmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  from: string;
  configured: boolean;
}

function normalizeAppPassword(pass: string) {
  return pass.replace(/\s/g, "");
}

export async function getSmtpConfig(): Promise<SmtpConfig> {
  const agency = await getAgencySettings();

  const host = agency?.smtpHost || process.env.SMTP_HOST || "smtp.gmail.com";
  const port = agency?.smtpPort || parseInt(process.env.SMTP_PORT || "587", 10);
  const user = agency?.smtpUser || process.env.SMTP_USER || "";
  const pass = normalizeAppPassword(process.env.SMTP_PASS || "");
  const secure = port === 465;

  // Gmail requires the From address to match the authenticated account (or a verified alias).
  const envFrom = process.env.SMTP_FROM || "";
  const agencyFrom = agency?.smtpFrom || "";
  const from =
    agencyFrom ||
    envFrom ||
    (user ? `${agency?.companyName || "Book to Roam"} <${user}>` : "");

  return {
    host,
    port,
    secure,
    user,
    pass,
    from,
    configured: Boolean(user && pass),
  };
}

export function getSmtpStatus(config: SmtpConfig) {
  return {
    configured: config.configured,
    host: config.host,
    port: config.port,
    user: config.user,
    from: config.from,
    secure: config.secure,
  };
}
