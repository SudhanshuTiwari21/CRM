import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { handleApiError, jsonOk, jsonError } from "@/lib/api-utils";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) return jsonError("Unauthorized", 401);

    const msmes = await prisma.agencyMsme.findMany({
      orderBy: [{ isDefault: "desc" }, { label: "asc" }],
    });
    return jsonOk({ msmes });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) return jsonError("Unauthorized", 401);

    const body = await request.json();
    const { label, number, isDefault } = body;
    if (!label?.trim() || !number?.trim()) {
      return jsonError("Label and number are required", 400);
    }

    if (isDefault) {
      await prisma.agencyMsme.updateMany({ data: { isDefault: false } });
    }

    const msme = await prisma.agencyMsme.upsert({
      where: { number: number.trim() },
      update: { label: label.trim(), isDefault: !!isDefault },
      create: { label: label.trim(), number: number.trim(), isDefault: !!isDefault },
    });

    return jsonOk({ msme });
  } catch (error) {
    return handleApiError(error);
  }
}
