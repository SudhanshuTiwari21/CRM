import { prisma } from "@/lib/db";
import type { EmailStatus } from "@prisma/client";
import { getWhatsAppConfig } from "@/lib/whatsapp-config";

/** Normalize to WhatsApp Cloud API format: country code + number, no + or spaces. */
export function normalizeWhatsAppPhone(phone: string, defaultCountryCode = "91") {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10) return `${defaultCountryCode}${digits}`;
  if (digits.length === 12 && digits.startsWith("91")) return digits;
  if (digits.length > 10) return digits;
  return `${defaultCountryCode}${digits}`;
}

export async function sendWhatsAppText(params: {
  to: string;
  body: string;
  bookingId?: string;
  template?: string;
}) {
  const config = await getWhatsAppConfig();
  const to = normalizeWhatsAppPhone(params.to);

  const log = await prisma.whatsAppLog.create({
    data: {
      bookingId: params.bookingId,
      to,
      template: params.template || "booking_confirmed",
      body: params.body,
      status: "PENDING",
    },
  });

  if (!config.configured) {
    const parts: string[] = [];
    if (!config.enabled) parts.push("enable WhatsApp in Settings");
    if (!config.accessToken) parts.push("set WHATSAPP_ACCESS_TOKEN in env");
    if (!config.phoneNumberId) parts.push("set Phone Number ID in Settings or env");
    const message = `WhatsApp not configured (${parts.join(", ") || "missing settings"}).`;
    await prisma.whatsAppLog.update({
      where: { id: log.id },
      data: { status: "FAILED" as EmailStatus, error: message },
    });
    return { success: false, whatsappLogId: log.id, error: message, skipped: true };
  }

  try {
    const url = `https://graph.facebook.com/${config.apiVersion}/${config.phoneNumberId}/messages`;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to,
        type: "text",
        text: { preview_url: true, body: params.body },
      }),
    });

    const data = (await res.json()) as {
      error?: { message?: string; code?: number; error_subcode?: number };
      messages?: { id: string }[];
    };

    if (!res.ok) {
      const errMsg = formatWhatsAppApiError(data.error?.message, data.error?.code, to);
      await prisma.whatsAppLog.update({
        where: { id: log.id },
        data: { status: "FAILED", error: errMsg },
      });
      return { success: false, whatsappLogId: log.id, error: errMsg };
    }

    await prisma.whatsAppLog.update({
      where: { id: log.id },
      data: { status: "SENT", sentAt: new Date() },
    });

    return { success: true, whatsappLogId: log.id, messageId: data.messages?.[0]?.id };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    await prisma.whatsAppLog.update({
      where: { id: log.id },
      data: { status: "FAILED", error: message },
    });
    return { success: false, whatsappLogId: log.id, error: message };
  }
}

function formatWhatsAppApiError(message?: string, code?: number, to?: string) {
  const base = message || `WhatsApp API error (${code ?? "unknown"})`;
  if (base.includes("not in allowed list") || code === 131030) {
    return `${base} - In Meta test mode, add ${to} under developers.facebook.com → WhatsApp → API Setup → "To" recipients (max 5 numbers).`;
  }
  if (base.includes("Re-engagement") || code === 131047) {
    return `${base} - Meta requires an approved message template for outbound messages. Use test mode or submit a template in Meta Business Manager.`;
  }
  if (base.includes("expired") || base.includes("Session has expired") || code === 190) {
    return `${base} - Regenerate your access token in Meta API Setup and update WHATSAPP_ACCESS_TOKEN.`;
  }
  return base;
}

export async function sendTestWhatsApp(to: string) {
  const agency = await prisma.agencySettings.findUnique({ where: { id: "default" } });
  const companyName = agency?.companyName || "Book to Roam";

  return sendWhatsAppText({
    to,
    template: "test",
    body: `*${companyName}* - WhatsApp integration test successful ✅\n\nBooking confirmation messages will be sent here alongside email.`,
  });
}
