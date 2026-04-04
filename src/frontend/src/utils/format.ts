export const CURRENCY_OPTIONS = [
  { code: "INR", label: "INR - Indian Rupee" },
  { code: "USD", label: "USD - US Dollar" },
  { code: "AED", label: "AED - UAE Dirham" },
  { code: "SAR", label: "SAR - Saudi Riyal" },
  { code: "GBP", label: "GBP - British Pound" },
  { code: "PKR", label: "PKR - Pakistani Rupee" },
];

export function detectCurrencyFromLocaleCode(): string {
  const locale = Intl.NumberFormat().resolvedOptions().locale;
  if (locale.includes("-IN") || locale === "hi" || locale === "en-IN") return "INR";
  if (locale.includes("-US") || locale === "en-US") return "USD";
  if (locale.includes("-AE") || locale === "ar-AE") return "AED";
  if (locale.includes("-SA") || locale === "ar-SA") return "SAR";
  if (locale.includes("-GB") || locale === "en-GB") return "GBP";
  if (locale.includes("-PK") || locale === "ur" || locale === "ur-PK") return "PKR";
  return "USD";
}

function normalizeLegacyCurrency(value: string | null): string | null {
  if (!value) return null;
  if (value === "₹") return "INR";
  if (value === "$") return "USD";
  if (value === "£") return "GBP";
  if (value === "₨") return "PKR";
  if (value === "AED" || value === "SAR" || value === "INR" || value === "USD" || value === "GBP" || value === "PKR") return value;
  return null;
}

export function getCurrencyCode(): string {
  const stored = normalizeLegacyCurrency(localStorage.getItem("currencyCode") || localStorage.getItem("currencyOverride"));
  return stored || detectCurrencyFromLocaleCode();
}

export function formatCurrency(amount: number): string {
  const locale = localStorage.getItem("language") || Intl.NumberFormat().resolvedOptions().locale;
  const currency = getCurrencyCode();
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatTimestamp(ts: bigint): string {
  const ms = Number(ts) / 1_000_000;
  const locale = localStorage.getItem("language") || Intl.NumberFormat().resolvedOptions().locale;
  const d = new Date(ms);
  return `${d.toLocaleDateString(locale, { day: "2-digit", month: "short", year: "numeric" })} ${d.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" })}`;
}

export function getInitials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export function isInactive(lastPaymentDate: bigint, days = 7): boolean {
  if (lastPaymentDate === BigInt(0)) return false;
  const ms = Number(lastPaymentDate) / 1_000_000;
  const diff = (Date.now() - ms) / (1000 * 60 * 60 * 24);
  return diff >= days;
}

export function getSettings() {
  return {
    threshold: Number.parseFloat(localStorage.getItem("threshold") || "1000"),
    inactiveDays: Number.parseInt(localStorage.getItem("inactiveDays") || "7"),
    reminderEnabled: localStorage.getItem("reminderEnabled") === "true",
  };
}
