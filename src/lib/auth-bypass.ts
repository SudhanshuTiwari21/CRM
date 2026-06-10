import type { Session } from "next-auth";
import type { UserRole } from "@prisma/client";
import { prisma } from "@/lib/db";

/** Auth is off unless DISABLE_AUTH=false (demo default). */
export function isAuthDisabled() {
  return process.env.DISABLE_AUTH !== "false";
}

let cachedBypassSession: Session | null = null;

export async function getBypassSession(): Promise<Session> {
  if (cachedBypassSession) return cachedBypassSession;

  const user = await prisma.user.findFirst({
    where: { role: "ADMIN", active: true },
    orderBy: { createdAt: "asc" },
  });

  const expires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

  cachedBypassSession = {
    expires,
    user: {
      id: user?.id ?? "bypass",
      email: user?.email ?? "admin@techrecoil.in",
      name: user?.name ?? "Admin",
      role: (user?.role ?? "ADMIN") as UserRole,
    },
  };

  return cachedBypassSession;
}
