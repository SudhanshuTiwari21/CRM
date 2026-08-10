import { PDFParse } from "pdf-parse";
import { parseTicketText, type ParsedProductType, type ParsedTicketResult } from "@/lib/services/ticket-parse.service";

const MAX_BYTES = 8 * 1024 * 1024; // 8 MB

export async function extractTextFromUpload(
  buffer: Buffer,
  mimeType: string,
  fileName: string
): Promise<string> {
  if (buffer.byteLength > MAX_BYTES) {
    throw new Error("File too large (max 8 MB)");
  }

  const lower = fileName.toLowerCase();
  const isPdf = mimeType === "application/pdf" || lower.endsWith(".pdf");
  const isText =
    mimeType.startsWith("text/") || lower.endsWith(".txt") || lower.endsWith(".csv");

  if (isText) {
    return buffer.toString("utf8");
  }

  if (!isPdf) {
    throw new Error(
      "Only PDF or text files are supported. Scanned images need OCR (not available in local mode)."
    );
  }

  const parser = new PDFParse({ data: buffer });
  try {
    const result = await parser.getText();
    const text = (result?.text || "").trim();
    if (!text) {
      throw new Error(
        "No text found in PDF. This looks like a scanned image — local extraction only works with text-based e-tickets."
      );
    }
    return text;
  } finally {
    // pdf-parse v2 may keep workers; destroy if available
    const maybeDestroy = (parser as { destroy?: () => Promise<void> }).destroy;
    if (typeof maybeDestroy === "function") {
      await maybeDestroy.call(parser).catch(() => undefined);
    }
  }
}

export async function parseUploadedTicket(params: {
  buffer: Buffer;
  mimeType: string;
  fileName: string;
  productHint?: ParsedProductType;
}): Promise<ParsedTicketResult> {
  const text = await extractTextFromUpload(params.buffer, params.mimeType, params.fileName);
  return parseTicketText(text, params.productHint);
}
