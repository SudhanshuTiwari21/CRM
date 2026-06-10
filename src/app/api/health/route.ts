import { NextResponse } from "next/server";
import { isAuthDisabled } from "@/lib/auth-bypass";

/** Safe env check for Vercel debugging — never exposes secret values. */
export async function GET() {
  const authDisabled = isAuthDisabled();

  const checks = {
    DISABLE_AUTH: authDisabled,
    AUTH_SECRET: Boolean(process.env.AUTH_SECRET?.length),
    AUTH_URL: Boolean(process.env.AUTH_URL?.length),
    AUTH_TRUST_HOST: process.env.AUTH_TRUST_HOST === "true",
    DATABASE_URL: Boolean(process.env.DATABASE_URL?.length),
    NODE_ENV: process.env.NODE_ENV ?? "unknown",
  };

  const ok = checks.DATABASE_URL && (authDisabled || checks.AUTH_SECRET);

  return NextResponse.json(
    {
      ok,
      checks,
      hint: ok
        ? authDisabled
          ? "Demo mode — no login required on any device."
          : "Login required. Set DISABLE_AUTH=false explicitly to keep auth on."
        : "Set DATABASE_URL on Vercel, then redeploy.",
    },
    { status: ok ? 200 : 503 }
  );
}
