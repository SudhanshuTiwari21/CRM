import { NextResponse } from "next/server";
import { ZodError } from "zod";

export function jsonOk<T>(data: T, status = 200) {
  return NextResponse.json(data, { status });
}

export function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export function handleApiError(error: unknown) {
  if (error instanceof ZodError) {
    return jsonError(error.errors.map((e) => e.message).join(", "), 400);
  }
  if (error instanceof Error) {
    if (error.message === "Unauthorized") return jsonError("Unauthorized", 401);
    if (error.message === "Forbidden") return jsonError("Forbidden", 403);
    return jsonError(error.message, 400);
  }
  return jsonError("Internal server error", 500);
}

export async function validateWebhookApiKey(request: Request) {
  const apiKey = request.headers.get("X-API-Key");
  const envKey = process.env.WEBHOOK_API_KEY;

  if (!envKey || apiKey !== envKey) {
    throw new Error("Invalid API key");
  }
}
