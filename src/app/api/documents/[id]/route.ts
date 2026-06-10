import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { generateBookingDocuments } from "@/lib/services/document.service";
import { handleApiError, jsonError } from "@/lib/api-utils";
import fs from "fs/promises";

export const runtime = "nodejs";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session?.user) return jsonError("Unauthorized", 401);

    const { id } = await params;

    let document = await prisma.document.findUnique({ where: { id } });
    if (!document) return jsonError("Document not found", 404);

    let fileBuffer: Buffer;
    try {
      fileBuffer = await fs.readFile(document.storagePath);
    } catch {
      await generateBookingDocuments(document.bookingId, session.user.id);
      document = await prisma.document.findUnique({ where: { id } });
      if (!document) return jsonError("Document not found", 404);
      fileBuffer = await fs.readFile(document.storagePath);
    }

    return new Response(new Uint8Array(fileBuffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${document.fileName}"`,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
