const STATE_CODES: Record<string, string> = {
  "01": "Jammu & Kashmir",
  "02": "Himachal Pradesh",
  "03": "Punjab",
  "04": "Chandigarh",
  "05": "Uttarakhand",
  "06": "Haryana",
  "07": "Delhi",
  "08": "Rajasthan",
  "09": "Uttar Pradesh",
  "10": "Bihar",
  "11": "Sikkim",
  "12": "Arunachal Pradesh",
  "13": "Nagaland",
  "14": "Manipur",
  "15": "Mizoram",
  "16": "Tripura",
  "17": "Meghalaya",
  "18": "Assam",
  "19": "West Bengal",
  "20": "Jharkhand",
  "21": "Odisha",
  "22": "Chhattisgarh",
  "23": "Madhya Pradesh",
  "24": "Gujarat",
  "26": "Dadra and Nagar Haveli and Daman and Diu",
  "27": "Maharashtra",
  "29": "Karnataka",
  "30": "Goa",
  "31": "Lakshadweep",
  "32": "Kerala",
  "33": "Tamil Nadu",
  "34": "Puducherry",
  "35": "Andaman and Nicobar Islands",
  "36": "Telangana",
  "37": "Andhra Pradesh",
  "38": "Ladakh",
};

const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;

export interface GstinLookupResult {
  gstin: string;
  legalName?: string;
  tradeName?: string;
  pan?: string;
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;
  status?: string;
  source: "api" | "parsed";
}

export function isValidGstin(gstin: string) {
  return GSTIN_REGEX.test(gstin.toUpperCase());
}

export function extractPanFromGstin(gstin: string) {
  const normalized = gstin.toUpperCase();
  if (!isValidGstin(normalized)) return null;
  return normalized.slice(2, 12);
}

export function getStateFromGstin(gstin: string) {
  const code = gstin.slice(0, 2);
  return STATE_CODES[code] || null;
}

export async function lookupGstin(gstin: string): Promise<GstinLookupResult> {
  const normalized = gstin.toUpperCase().trim();
  if (!isValidGstin(normalized)) {
    throw new Error("Invalid GSTIN format");
  }

  const pan = extractPanFromGstin(normalized) || undefined;
  const state = getStateFromGstin(normalized) || undefined;

  const apiKey = process.env.GSTIN_API_KEY;
  if (apiKey) {
    try {
      const res = await fetch(
        `https://appyflow.in/api/verifyGST?gstNo=${normalized}&key=${apiKey}`,
        { next: { revalidate: 86400 } }
      );
      if (res.ok) {
        const data = await res.json();
        const taxpayer = data.taxpayerInfo || data;
        const addr = taxpayer.pradr?.addr || taxpayer.adadr?.[0]?.addr;
        const addressLine = addr
          ? [addr.bno, addr.bnm, addr.st, addr.loc, addr.dst, addr.stcd, addr.pncd]
              .filter(Boolean)
              .join(", ")
          : taxpayer.principalPlaceOfBusiness || taxpayer.address;

        return {
          gstin: normalized,
          legalName: taxpayer.lgnm || taxpayer.legalName || taxpayer.tradeNam,
          tradeName: taxpayer.tradeNam || taxpayer.tradeName,
          pan: pan || taxpayer.pan,
          address: addressLine,
          city: addr?.loc || addr?.dst,
          state: addr?.stcd || state,
          pincode: addr?.pncd,
          status: taxpayer.sts || taxpayer.status,
          source: "api",
        };
      }
    } catch {
      // fall through to parsed result
    }
  }

  return {
    gstin: normalized,
    pan,
    state,
    source: "parsed",
  };
}
