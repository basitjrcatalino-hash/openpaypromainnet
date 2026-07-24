import { useEffect, useState } from "react";

export type CurrencyCode = "USD" | "EUR" | "GBP" | "PI";

export const CURRENCIES: { code: CurrencyCode; symbol: string; rate: number; label: string }[] = [
  { code: "USD", symbol: "$", rate: 1, label: "US Dollar" },
  { code: "EUR", symbol: "€", rate: 0.92, label: "Euro" },
  { code: "GBP", symbol: "£", rate: 0.78, label: "British Pound" },
  { code: "PI", symbol: "π", rate: 1 / 0.65, label: "Pi" },
];

const STORAGE_KEY = "op:currency";

export function formatCurrency(usd: number, code: CurrencyCode = "USD"): string {
  const c = CURRENCIES.find((x) => x.code === code) ?? CURRENCIES[0];
  const value = Number(usd || 0) * c.rate;
  if (code === "PI") return `${c.symbol}${value.toFixed(2)}`;
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: code, maximumFractionDigits: 2 }).format(value);
  } catch {
    return `${c.symbol}${value.toFixed(2)}`;
  }
}

export function useCurrency() {
  const [code, setCode] = useState<CurrencyCode>("USD");
  useEffect(() => {
    const saved = typeof window !== "undefined" ? (localStorage.getItem(STORAGE_KEY) as CurrencyCode | null) : null;
    if (saved && CURRENCIES.some((c) => c.code === saved)) setCode(saved);
  }, []);
  const update = (next: CurrencyCode) => {
    setCode(next);
    try { localStorage.setItem(STORAGE_KEY, next); } catch {}
    window.dispatchEvent(new CustomEvent("op:currency-change", { detail: next }));
  };
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as CurrencyCode;
      if (detail && detail !== code) setCode(detail);
    };
    window.addEventListener("op:currency-change", handler);
    return () => window.removeEventListener("op:currency-change", handler);
  }, [code]);
  const cycle = () => {
    const idx = CURRENCIES.findIndex((c) => c.code === code);
    update(CURRENCIES[(idx + 1) % CURRENCIES.length].code);
  };
  return { code, setCode: update, cycle };
}

export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
