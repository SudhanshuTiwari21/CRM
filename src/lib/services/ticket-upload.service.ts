import { PDFParse } from "pdf-parse";
import { parseTicketText, type ParsedProductType, type ParsedTicketResult } from "@/lib/services/ticket-parse.service";
import {
  isOpenAITicketParseEnabled,
  parseTicketWithOpenAI,
} from "@/lib/services/ticket-ai-parse.service";

const MAX_BYTES = 8 * 1024 * 1024; // 8 MB

const IMAGE_MIME = new Set(["image/png", "image/jpeg", "image/jpg", "image/webp", "image/gif"]);

function isPdf(mimeType: string, fileName: string) {
  const lower = fileName.toLowerCase();
  return mimeType === "application/pdf" || lower.endsWith(".pdf");
}

function isImage(mimeType: string, fileName: string) {
  const lower = fileName.toLowerCase();
  return IMAGE_MIME.has(mimeType.toLowerCase()) || /\.(png|jpe?g|webp|gif)$/i.test(lower);
}

function isText(mimeType: string, fileName: string) {
  const lower = fileName.toLowerCase();
  return mimeType.startsWith("text/") || lower.endsWith(".txt") || lower.endsWith(".csv");
}

export async function extractTextFromUpload(
  buffer: Buffer,
  mimeType: string,
  fileName: string
): Promise<string> {
  if (buffer.byteLength > MAX_BYTES) {
    throw new Error("File too large (max 8 MB)");
  }

  if (isText(mimeType, fileName)) {
    return buffer.toString("utf8");
  }

  if (isImage(mimeType, fileName)) {
    return ""; // vision path — no local text
  }

  if (!isPdf(mimeType, fileName)) {
    throw new Error("Unsupported file type. Upload a PDF, PNG, JPG, or WEBP ticket.");
  }

  const parser = new PDFParse({ data: buffer });
  try {
    const result = await parser.getText();
    return (result?.text || "").trim();
  } finally {
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
  if (params.buffer.byteLength > MAX_BYTES) {
    throw new Error("File too large (max 8 MB)");
  }

  const extractedText = await extractTextFromUpload(
    params.buffer,
    params.mimeType,
    params.fileName
  );

  const useOpenAI = isOpenAITicketParseEnabled();
  const imageUpload = isImage(params.mimeType, params.fileName);
  const scannedPdf = isPdf(params.mimeType, params.fileName) && extractedText.length < 40;

  if (useOpenAI) {
    try {
      return await parseTicketWithOpenAI({
        buffer: params.buffer,
        mimeType: params.mimeType,
        fileName: params.fileName,
        productHint: params.productHint,
        extractedText,
      });
    } catch (error) {
      // Images / scanned PDFs have no useful local fallback
      if (imageUpload || scannedPdf) throw error;
      console.error("[ticket-import] OpenAI parse failed, falling back to local:", error);
      const local = parseTicketText(extractedText, params.productHint);
      local.warnings = [
        `OpenAI parse failed (${error instanceof Error ? error.message : "unknown"}) — used local text parser instead.`,
        ...local.warnings,
      ];
      return local;
    }
  }

  if (imageUpload) {
    throw new Error(
      "Image tickets need OpenAI. Add OPENAI_API_KEY to your environment, then retry."
    );
  }

  if (scannedPdf) {
    throw new Error(
      "No text found in PDF (likely a scan). Add OPENAI_API_KEY to parse scanned PDFs/images, or upload a text-based e-ticket."
    );
  }

  return parseTicketText(extractedText, params.productHint);
}
