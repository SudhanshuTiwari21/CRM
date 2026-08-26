import { prisma } from "@/lib/db";
import { getAgencySettings } from "@/lib/brand-context";

export interface WhatsAppConfig {
  enabled: boolean;
  phoneNumberId: string;
  accessToken: string;
  apiVersion: string;
  configured: boolean;
}

export async function getWhatsAppConfig(): Promise<WhatsAppConfig> {
  const agency = await getAgencySettings();

  const phoneNumberId = agency?.whatsappPhoneNumberId || process.env.WHATSAPP_PHONE_NUMBER_ID || "";
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN || "";
  const apiVersion = agency?.whatsappApiVersion || process.env.WHATSAPP_API_VERSION || "v21.0";
  const enabled =
    process.env.WHATSAPP_DISABLED === "true"
      ? false
      : Boolean(agency?.whatsappEnabled) || process.env.WHATSAPP_ENABLED === "true";

  return {
    enabled,
    phoneNumberId,
    accessToken,
    apiVersion,
    configured: Boolean(enabled && phoneNumberId && accessToken),
  };
}

export function getWhatsAppStatus(config: WhatsAppConfig) {
  return {
    enabled: config.enabled,
    configured: config.configured,
    phoneNumberId: config.phoneNumberId ? `••••${config.phoneNumberId.slice(-6)}` : "",
    apiVersion: config.apiVersion,
    hasToken: Boolean(config.accessToken),
  };
}
