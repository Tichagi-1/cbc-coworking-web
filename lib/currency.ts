import { api } from "@/lib/api";

const CURRENCY_SYMBOLS: Record<string, string> = {
  UZS: "сум", USD: "$", EUR: "€", RUB: "₽", GBP: "£",
  KZT: "₸", CNY: "¥", TRY: "₺", AED: "د.إ",
  CHF: "CHF", JPY: "¥", INR: "₹", KRW: "₩",
};

let currentCurrency = "UZS";
let loaded = false;

export async function loadCurrency(): Promise<void> {
  try {
    const res = await api.get<{ currency: string; timezone: string }>("/settings/general");
    currentCurrency = res.data.currency || "UZS";
    loaded = true;
  } catch {
    // keep default
  }
}

export function setCurrency(code: string) {
  currentCurrency = code;
}

export function getCurrency(): string {
  return currentCurrency;
}

export function getCurrencySymbol(): string {
  return CURRENCY_SYMBOLS[currentCurrency] || currentCurrency;
}

export function formatMoney(amount: number): string {
  const symbol = CURRENCY_SYMBOLS[currentCurrency] || currentCurrency;
  if (Math.abs(amount) >= 1_000_000) {
    return `${(amount / 1_000_000).toFixed(1)}M ${symbol}`;
  }
  return `${Math.round(amount).toLocaleString()} ${symbol}`;
}

export function isLoaded(): boolean {
  return loaded;
}
