import { NextResponse } from "next/server";

/** Safe env check for Vercel debugging — never exposes secret values. */
export async function GET() {
  const checks = {
    AUTH_SECRET: Boolean(process.env.AUTH_SECRET?.length),
    AUTH_URL: Boolean(process.env.AUTH_URL?.length),
    AUTH_TRUST_HOST: process.env.AUTH_TRUST_HOST === "true",
    DATABASE_URL: Boolean(process.env.DATABASE_URL?.length),
    NODE_ENV: process.env.NODE_ENV ?? "unknown",
  };

  const ok = checks.AUTH_SECRET && checks.DATABASE_URL;

  return NextResponse.json(
    {
      ok,
      checks,
      hint: ok
        ? "Env looks good. If login still fails, redeploy after changing variables."
        : "Set missing vars in Vercel → Settings → Environment Variables → Production, then Redeploy.",
    },
    { status: ok ? 200 : 503 }
  );
}
