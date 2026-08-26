import nodemailer from "nodemailer";
import type SMTPTransport from "nodemailer/lib/smtp-transport";
import { prisma } from "@/lib/db";
import type { EmailStatus } from "@prisma/client";
import fs from "fs/promises";
import path from "path";
import { resolveDocumentPath } from "@/lib/services/document.service";
import { getSmtpConfig } from "@/lib/smtp-config";
import { getActiveDbBrand, getAgencySettings } from "@/lib/brand-context";

export type EmailAttachment = {
  filename: string;
  content: Buffer;
  contentType: string;
  /** Content-ID for inline images - reference in HTML as src="cid:..." */
  cid?: string;
};

interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
  bookingId?: string;
  template: string;
  attachments?: EmailAttachment[];
  inlineAttachments?: EmailAttachment[];
}

function renderTemplate(template: string, vars: Record<string, string>) {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? "");
}

function wrapHtmlEmail(bodyHtml: string, companyName: string) {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
</head>
<body style="margin:0;padding:0;background:#f4f6f8;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f8;padding:24px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.06);">
          <tr>
            <td style="background:#1e3a8a;padding:20px 32px;">
              <h1 style="margin:0;color:#ffffff;font-size:20px;font-weight:600;">${companyName}</h1>
              <p style="margin:4px 0 0;color:#bfdbfe;font-size:12px;">Flight • Hotel • Bus Bookings</p>
            </td>
          </tr>
          <tr>
            <td style="padding:32px;color:#1f2937;font-size:15px;line-height:1.6;">
              ${bodyHtml}
            </td>
          </tr>
          <tr>
            <td style="padding:16px 32px;background:#f9fafb;border-top:1px solid #e5e7eb;color:#6b7280;font-size:12px;">
              This is an automated message from ${companyName}. Please do not reply directly to this email.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export async function createSmtpTransporter() {
  const config = await getSmtpConfig();

  if (!config.configured) {
    throw new Error("SMTP not configured. Set SMTP_USER and SMTP_PASS in .env");
  }

  const transportOptions: SMTPTransport.Options = {
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: {
      user: config.user,
      pass: config.pass,
    },
    tls: {
      minVersion: "TLSv1.2",
    },
  };

  // Gmail on port 587 uses STARTTLS
  if (config.host.includes("gmail.com") && config.port === 587) {
    transportOptions.secure = false;
    transportOptions.requireTLS = true;
  }

  const transporter = nodemailer.createTransport(transportOptions);
  await transporter.verify();
  return { transporter, config };
}

export async function sendTemplatedEmail(params: {
  templateKey: string;
  to: string;
  vars: Record<string, string>;
  bookingId?: string;
  attachments?: EmailAttachment[];
  inlineAttachments?: EmailAttachment[];
  htmlOverride?: string;
}) {
  const brandId = await getActiveDbBrand();
  const template = await prisma.emailTemplate.findUnique({
    where: { brandId_key: { brandId, key: params.templateKey } },
  });

  if (!template) {
    throw new Error(`Email template not found: ${params.templateKey}`);
  }

  const agency = await getAgencySettings();
  const companyName = agency?.companyName || params.vars.companyName || "Book to Roam";

  const subject = renderTemplate(template.subject, params.vars);
  const html =
    params.htmlOverride ??
    wrapHtmlEmail(renderTemplate(template.body, params.vars).replace(/\n/g, "<br>"), companyName);

  return sendEmail({
    to: params.to,
    subject,
    html,
    bookingId: params.bookingId,
    template: params.templateKey,
    attachments: params.attachments,
    inlineAttachments: params.inlineAttachments,
  });
}

export async function sendEmail(params: SendEmailParams) {
  const emailLog = await prisma.emailLog.create({
    data: {
      bookingId: params.bookingId,
      to: params.to,
      subject: params.subject,
      template: params.template,
      status: "PENDING",
    },
  });

  try {
    const { transporter, config } = await createSmtpTransporter();

    await transporter.sendMail({
      from: config.from,
      to: params.to,
      subject: params.subject,
      html: params.html,
      attachments: [...(params.inlineAttachments || []), ...(params.attachments || [])],
    });

    await prisma.emailLog.update({
      where: { id: emailLog.id },
      data: { status: "SENT", sentAt: new Date() },
    });

    return { success: true, emailLogId: emailLog.id };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    await prisma.emailLog.update({
      where: { id: emailLog.id },
      data: { status: "FAILED" as EmailStatus, error: message },
    });
    return { success: false, emailLogId: emailLog.id, error: message };
  }
}

export async function sendTestEmail(to: string) {
  const agency = await getAgencySettings();
  const companyName = agency?.companyName || "Book to Roam";

  const html = wrapHtmlEmail(
    `<p>Your Gmail SMTP integration is working correctly.</p>
     <p><strong>Agency:</strong> ${companyName}</p>
     <p>Booking confirmation emails with PDF attachments will be sent through this account.</p>`,
    companyName
  );

  return sendEmail({
    to,
    subject: `${companyName} - SMTP Test Successful`,
    html,
    template: "smtp_test",
  });
}

export async function getEmailAttachments(documentPaths: string[]) {
  const attachments: EmailAttachment[] = [];
  for (const docPath of documentPaths) {
    try {
      const fileName = path.basename(docPath) || "document.pdf";
      const resolved = (await resolveDocumentPath(docPath, fileName)) ?? docPath;
      const content = await fs.readFile(resolved);
      if (!content.length) {
        console.error(`Email attachment is empty: ${resolved}`);
        continue;
      }
      attachments.push({
        filename: fileName,
        content,
        contentType: "application/pdf",
      });
    } catch (error) {
      console.error(`Email attachment missing: ${docPath}`, error);
    }
  }
  return attachments;
}
