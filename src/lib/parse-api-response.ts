/** Parse CRM API responses safely - avoids "Unexpected token '<'" when HTML is returned. */
export async function parseApiResponse(res: Response): Promise<{ ok: boolean; data: Record<string, unknown>; error?: string }> {
  const contentType = res.headers.get("content-type") || "";

  if (!contentType.includes("application/json")) {
    if (res.status === 401) {
      return { ok: false, data: {}, error: "Please sign in to continue." };
    }
    if (res.status === 403) {
      return { ok: false, data: {}, error: "You do not have permission for this action." };
    }
    return {
      ok: false,
      data: {},
      error: `Server error (${res.status}). If this persists, check you are logged in and try again.`,
    };
  }

  const data = await res.json();
  if (!res.ok) {
    return { ok: false, data, error: (data.error as string) || "Request failed" };
  }
  return { ok: true, data };
}
