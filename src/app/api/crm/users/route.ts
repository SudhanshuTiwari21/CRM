import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { hash } from "bcryptjs";
import { z } from "zod";
import { handleApiError, jsonOk } from "@/lib/api-utils";

const createUserSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(6),
  role: z.enum(["ADMIN", "AGENT"]),
});

export async function POST(request: Request) {
  try {
    await requireAdmin();
    const body = await request.json();
    const data = createUserSchema.parse(body);

    const passwordHash = await hash(data.password, 12);
    const user = await prisma.user.create({
      data: {
        name: data.name,
        email: data.email,
        passwordHash,
        role: data.role,
      },
      select: { id: true, name: true, email: true, role: true, active: true },
    });

    return jsonOk(user, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
