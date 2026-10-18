import { auth } from "@/lib/auth";
import { handleApiError, jsonOk, jsonError } from "@/lib/api-utils";

type NominatimResult = {
  place_id: number;
  display_name: string;
  name?: string;
  address?: {
    city?: string;
    town?: string;
    village?: string;
    municipality?: string;
    state?: string;
    country?: string;
  };
};

export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) return jsonError("Unauthorized", 401);

    const { searchParams } = new URL(request.url);
    const q = (searchParams.get("q") || "").trim();
    if (q.length < 2) return jsonOk({ cities: [] });

    const url = new URL("https://nominatim.openstreetmap.org/search");
    url.searchParams.set("q", q);
    url.searchParams.set("format", "json");
    url.searchParams.set("addressdetails", "1");
    url.searchParams.set("limit", "8");
    url.searchParams.set("featuretype", "city");

    const res = await fetch(url.toString(), {
      headers: {
        Accept: "application/json",
        "User-Agent": "FlightBookingCRM/1.0 (itinerary city autocomplete)",
      },
      next: { revalidate: 0 },
    });

    if (!res.ok) {
      return jsonError("City lookup failed. Try again in a moment.", 502);
    }

    const data = (await res.json()) as NominatimResult[];
    const seen = new Set<string>();
    const cities = data
      .map((row) => {
        const city =
          row.address?.city ||
          row.address?.town ||
          row.address?.village ||
          row.address?.municipality ||
          row.name ||
          row.display_name.split(",")[0];
        const country = row.address?.country || "";
        const state = row.address?.state || "";
        const label = [city, state, country].filter(Boolean).join(", ");
        return {
          id: String(row.place_id),
          city: (city || "").trim(),
          country,
          state,
          label,
        };
      })
      .filter((c) => {
        if (!c.city) return false;
        const key = c.label.toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });

    return jsonOk({ cities });
  } catch (error) {
    return handleApiError(error);
  }
}
