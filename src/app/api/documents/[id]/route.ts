import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { handleApiError, jsonError } from "@/lib/api-utils";
import fs from "fs/promises";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session?.user) return jsonError("Unauthorized", 401);

    const { id } = await params;

    const document = await prisma.document.findUnique({ where: { id } });
    if (!document) return jsonError("Document not found", 404);

    const fileBuffer = await fs.readFile(document.storagePath);

    return new Response(fileBuffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${document.fileName}"`,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
