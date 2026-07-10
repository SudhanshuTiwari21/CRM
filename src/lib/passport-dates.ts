/** ISO date (YYYY-MM-DD) → expiry 15 years later (Indian passport default). */
export function passportExpiryFromIssueDate(issueDate: string): string {
  if (!issueDate?.trim()) return "";
  const parts = issueDate.trim().split("-").map(Number);
  if (parts.length !== 3) return "";
  const [year, month, day] = parts;
  const date = new Date(year, month - 1, day);
  if (Number.isNaN(date.getTime())) return "";
  date.setFullYear(date.getFullYear() + 15);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function formatPassportDate(isoDate?: string | null): string {
  if (!isoDate?.trim()) return "-";
  const [y, m, d] = isoDate.split("-");
  if (!y || !m || !d) return isoDate;
  return `${d}/${m}/${y}`;
}
