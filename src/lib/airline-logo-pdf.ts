import { getAirlineLogoUrl } from "@/lib/airline-logo";

const cache = new Map<string, string | null>();

/** Fetch airline logo as data URI for @react-pdf/renderer. */
export async function getAirlineLogoDataUri(airlineName: string): Promise<string | null> {
  const key = airlineName.trim().toLowerCase();
  if (cache.has(key)) return cache.get(key) ?? null;

  const url = getAirlineLogoUrl(airlineName);
  if (!url) {
    cache.set(key, null);
    return null;
  }

  try {
    const res = await fetch(url);
    if (!res.ok) {
      cache.set(key, null);
      return null;
    }
    const buf = Buffer.from(await res.arrayBuffer());
    const dataUri = `data:image/png;base64,${buf.toString("base64")}`;
    cache.set(key, dataUri);
    return dataUri;
  } catch {
    cache.set(key, null);
    return null;
  }
}
