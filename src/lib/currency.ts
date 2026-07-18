export const CURRENCIES = ["INR", "USD", "AED", "EUR", "GBP"] as const;
export type CurrencyCode = (typeof CURRENCIES)[number];

const SYMBOLS: Record<CurrencyCode, string> = {
  INR: "₹",
  USD: "$",
  AED: "د.إ",
  EUR: "€",
  GBP: "£",
};

const LOCALES: Record<CurrencyCode, string> = {
  INR: "en-IN",
  USD: "en-US",
  AED: "en-AE",
  EUR: "en-IE",
  GBP: "en-GB",
};

export function currencySymbol(code: CurrencyCode) {
  return SYMBOLS[code] ?? "$";
}

export function formatMoney(amount: number, code: CurrencyCode = "USD") {
  try {
    return new Intl.NumberFormat(LOCALES[code], {
      style: "currency",
      currency: code,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${currencySymbol(code)}${amount.toFixed(2)}`;
  }
}
