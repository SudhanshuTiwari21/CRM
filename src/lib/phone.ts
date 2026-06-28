/** Strip formatting and normalize Indian mobile numbers to 10 digits. */
export function normalizePhone(phone: string): string {
  let digits = phone.replace(/\D/g, "");
  if (digits.length === 12 && digits.startsWith("91")) {
    digits = digits.slice(2);
  } else if (digits.length === 11 && digits.startsWith("0")) {
    digits = digits.slice(1);
  }
  return digits;
}

export function isValidIndianMobile(phone: string): boolean {
  const normalized = normalizePhone(phone);
  return normalized.length === 10 && /^[6-9]\d{9}$/.test(normalized);
}

/** All stored formats that should match the same customer. */
export function phoneLookupVariants(phone: string): string[] {
  const trimmed = phone.trim();
  const normalized = normalizePhone(trimmed);
  const variants = new Set<string>([trimmed, normalized]);
  if (normalized.length === 10) {
    variants.add(`0${normalized}`);
    variants.add(`91${normalized}`);
    variants.add(`+91${normalized}`);
  }
  return [...variants];
}
