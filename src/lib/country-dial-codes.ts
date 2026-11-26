export type CountryDialCode = {
  iso2: string;
  name: string;
  dial: string;
  flag: string;
};

/** Common travel markets first, then alphabetical by name. */
export const COUNTRY_DIAL_CODES: CountryDialCode[] = [
  { iso2: "IN", name: "India", dial: "91", flag: "🇮🇳" },
  { iso2: "VN", name: "Vietnam", dial: "84", flag: "🇻🇳" },
  { iso2: "TH", name: "Thailand", dial: "66", flag: "🇹🇭" },
  { iso2: "AE", name: "United Arab Emirates", dial: "971", flag: "🇦🇪" },
  { iso2: "SG", name: "Singapore", dial: "65", flag: "🇸🇬" },
  { iso2: "MY", name: "Malaysia", dial: "60", flag: "🇲🇾" },
  { iso2: "ID", name: "Indonesia", dial: "62", flag: "🇮🇩" },
  { iso2: "LK", name: "Sri Lanka", dial: "94", flag: "🇱🇰" },
  { iso2: "NP", name: "Nepal", dial: "977", flag: "🇳🇵" },
  { iso2: "BD", name: "Bangladesh", dial: "880", flag: "🇧🇩" },
  { iso2: "US", name: "United States", dial: "1", flag: "🇺🇸" },
  { iso2: "GB", name: "United Kingdom", dial: "44", flag: "🇬🇧" },
  { iso2: "AU", name: "Australia", dial: "61", flag: "🇦🇺" },
  { iso2: "FR", name: "France", dial: "33", flag: "🇫🇷" },
  { iso2: "DE", name: "Germany", dial: "49", flag: "🇩🇪" },
  { iso2: "IT", name: "Italy", dial: "39", flag: "🇮🇹" },
  { iso2: "ES", name: "Spain", dial: "34", flag: "🇪🇸" },
  { iso2: "CH", name: "Switzerland", dial: "41", flag: "🇨🇭" },
  { iso2: "NL", name: "Netherlands", dial: "31", flag: "🇳🇱" },
  { iso2: "QA", name: "Qatar", dial: "974", flag: "🇶🇦" },
  { iso2: "SA", name: "Saudi Arabia", dial: "966", flag: "🇸🇦" },
  { iso2: "OM", name: "Oman", dial: "968", flag: "🇴🇲" },
  { iso2: "BH", name: "Bahrain", dial: "973", flag: "🇧🇭" },
  { iso2: "KW", name: "Kuwait", dial: "965", flag: "🇰🇼" },
  { iso2: "HK", name: "Hong Kong", dial: "852", flag: "🇭🇰" },
  { iso2: "JP", name: "Japan", dial: "81", flag: "🇯🇵" },
  { iso2: "KR", name: "South Korea", dial: "82", flag: "🇰🇷" },
  { iso2: "CN", name: "China", dial: "86", flag: "🇨🇳" },
  { iso2: "PH", name: "Philippines", dial: "63", flag: "🇵🇭" },
  { iso2: "MV", name: "Maldives", dial: "960", flag: "🇲🇻" },
  { iso2: "MU", name: "Mauritius", dial: "230", flag: "🇲🇺" },
  { iso2: "ZA", name: "South Africa", dial: "27", flag: "🇿🇦" },
  { iso2: "CA", name: "Canada", dial: "1", flag: "🇨🇦" },
  { iso2: "NZ", name: "New Zealand", dial: "64", flag: "🇳🇿" },
];

const sortedByDialLength = [...COUNTRY_DIAL_CODES].sort(
  (a, b) => b.dial.length - a.dial.length
);

export function findCountryByDial(dial: string) {
  return COUNTRY_DIAL_CODES.find((c) => c.dial === dial) || null;
}

export function findCountryByIso2(iso2: string) {
  return COUNTRY_DIAL_CODES.find((c) => c.iso2 === iso2) || null;
}

/** Split stored phone into dial code + national number. Defaults to India. */
export function splitPhoneWithCountry(
  phone?: string | null,
  defaultIso2 = "IN"
): { iso2: string; dial: string; national: string } {
  const fallback = findCountryByIso2(defaultIso2) || COUNTRY_DIAL_CODES[0];
  const raw = (phone || "").trim();
  if (!raw) {
    return { iso2: fallback.iso2, dial: fallback.dial, national: "" };
  }

  const digits = raw.replace(/\D/g, "");
  if (!digits) {
    return { iso2: fallback.iso2, dial: fallback.dial, national: "" };
  }

  // Prefer matching when value was stored with + / country prefix
  if (raw.startsWith("+") || digits.length > 10) {
    for (const country of sortedByDialLength) {
      if (digits.startsWith(country.dial) && digits.length > country.dial.length) {
        return {
          iso2: country.iso2,
          dial: country.dial,
          national: digits.slice(country.dial.length),
        };
      }
    }
  }

  // Plain local number (e.g. 10-digit Indian mobile)
  return { iso2: fallback.iso2, dial: fallback.dial, national: digits };
}

/** Combine dial + national into +E.164-ish storage form. */
export function joinPhoneWithCountry(dial: string, national: string): string {
  const n = national.replace(/\D/g, "");
  if (!n) return "";
  const d = dial.replace(/\D/g, "");
  return `+${d}${n}`;
}
