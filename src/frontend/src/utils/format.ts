function detectCurrencyFromLocale(): string {
  const lang = navigator.language || "";
  if (
    lang.includes("-IN") ||
    lang === "hi" ||
    lang === "ur" ||
    lang === "en-IN"
  )
    return "₹";
  if (lang.includes("-PK") || lang === "ur-PK") return "₨";
  if (lang.includes("-AE") || lang === "ar-AE") return "AED";
  if (lang.includes("-SA") || lang === "ar-SA") return "SAR";
  if (lang.includes("-GB") || lang === "en-GB") return "£";
  if (lang.includes("-US") || lang === "en-US") return "$";
  return "₹";
}

export function getCurrencySymbol(): string {
  return localStorage.getItem("currencyOverride") || detectCurrencyFromLocale();
}

export function formatCurrency(amount: number): string {
  const symbol = getCurrencySymbol();
  return `${symbol}${amount.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
}

export function formatTimestamp(ts: bigint): string {
  const ms = Number(ts) / 1_000_000;
  const d = new Date(ms);
  return `${d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })} ${d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}`;
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
