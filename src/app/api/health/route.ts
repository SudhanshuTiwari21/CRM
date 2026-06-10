import { NextResponse } from "next/server";

/** Safe env check for Vercel debugging — never exposes secret values. */
export async function GET() {
  const authDisabled = process.env.DISABLE_AUTH === "true";

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
        ? "Env looks good. If login still fails, redeploy after changing variables."
        : "Set missing vars in Vercel → Settings → Environment Variables → Production, then Redeploy.",
    },
    { status: ok ? 200 : 503 }
  );
}
