import { useEffect, useState } from "react";
import { getCachedPiUsdPrice, fetchMajorUsdPrices } from "@/lib/ledger-majors";

/**
 * Phantom-style display currencies. Values convert from USD via live FX rates
 * (fawazahmed0 currency-api). PI uses live CoinGecko PI/USD.
 */
export type CurrencyMeta = {
  code: string;
  name: string;
  symbol: string;
  /** Fallback units-per-USD when live rates are unavailable */
  rate: number;
};

export const CURRENCIES: CurrencyMeta[] = [
  { code: "USD", name: "United States Dollar", symbol: "$", rate: 1 },
  { code: "EUR", name: "Euro", symbol: "€", rate: 0.92 },
  { code: "DZD", name: "Algerian Dinar", symbol: "د.ج", rate: 134 },
  { code: "ARS", name: "Argentine Peso", symbol: "AR$", rate: 980 },
  { code: "AUD", name: "Australian Dollar", symbol: "A$", rate: 1.55 },
  { code: "BRL", name: "Brazilian Real", symbol: "R$", rate: 5.6 },
  { code: "GBP", name: "British Pound", symbol: "£", rate: 0.78 },
  { code: "BGN", name: "Bulgarian Lev", symbol: "лв", rate: 1.8 },
  { code: "CAD", name: "Canadian Dollar", symbol: "CA$", rate: 1.38 },
  { code: "CNY", name: "Chinese Renminbi Yuan", symbol: "¥", rate: 7.25 },
  { code: "COP", name: "Colombian Peso", symbol: "$", rate: 4100 },
  { code: "CZK", name: "Czech Koruna", symbol: "Kč", rate: 23 },
  { code: "DKK", name: "Danish Krone", symbol: "kr", rate: 6.9 },
  { code: "DOP", name: "Dominican Peso", symbol: "RD$", rate: 60 },
  { code: "EGP", name: "Egyptian Pound", symbol: "E£", rate: 50 },
  { code: "ETB", name: "Ethiopian Birr", symbol: "Br", rate: 120 },
  { code: "HKD", name: "Hong Kong Dollar", symbol: "HK$", rate: 7.8 },
  { code: "INR", name: "Indian Rupee", symbol: "₹", rate: 84 },
  { code: "IDR", name: "Indonesian Rupiah", symbol: "Rp", rate: 16200 },
  { code: "ILS", name: "Israeli New Shekel", symbol: "₪", rate: 3.7 },
  { code: "JPY", name: "Japanese Yen", symbol: "¥", rate: 155 },
  { code: "JOD", name: "Jordanian Dinar", symbol: "أ.د", rate: 0.71 },
  { code: "KES", name: "Kenyan Shilling", symbol: "KSh", rate: 129 },
  { code: "KWD", name: "Kuwaiti Dinar", symbol: "د.ك", rate: 0.31 },
  { code: "MYR", name: "Malaysian Ringgit", symbol: "RM", rate: 4.5 },
  { code: "MXN", name: "Mexican Peso", symbol: "Mex$", rate: 19.5 },
  { code: "NZD", name: "New Zealand Dollar", symbol: "NZ$", rate: 1.7 },
  { code: "NGN", name: "Nigerian Naira", symbol: "₦", rate: 1600 },
  { code: "NOK", name: "Norwegian Krone", symbol: "kr", rate: 11 },
  { code: "OMR", name: "Omani Rial", symbol: "ر.ع.", rate: 0.38 },
  { code: "PKR", name: "Pakistan Rupee", symbol: "Rs", rate: 278 },
  { code: "PEN", name: "Peruvian Sol", symbol: "S/", rate: 3.75 },
  { code: "PHP", name: "Philippine Peso", symbol: "₱", rate: 58 },
  { code: "PLN", name: "Polish Złoty", symbol: "zł", rate: 4 },
  { code: "RON", name: "Romanian Leu", symbol: "lei", rate: 4.6 },
  { code: "SAR", name: "Saudi Riyal", symbol: "﷼", rate: 3.75 },
  { code: "SGD", name: "Singapore Dollar", symbol: "S$", rate: 1.35 },
  { code: "ZAR", name: "South African Rand", symbol: "R", rate: 18.5 },
  { code: "KRW", name: "South Korean Won", symbol: "₩", rate: 1380 },
  { code: "LKR", name: "Sri Lankan Rupee", symbol: "Rs", rate: 300 },
  { code: "SEK", name: "Swedish Krona", symbol: "kr", rate: 10.8 },
  { code: "CHF", name: "Swiss Franc", symbol: "CHF", rate: 0.88 },
  { code: "TWD", name: "Taiwan Dollar", symbol: "NT$", rate: 32.5 },
  { code: "THB", name: "Thai Baht", symbol: "฿", rate: 35 },
  { code: "TRY", name: "Turkish Lira", symbol: "₺", rate: 34 },
  { code: "UAH", name: "Ukrainian Hryvnia", symbol: "₴", rate: 41 },
  { code: "AED", name: "United Arab Emirates Dirham", symbol: "د.إ", rate: 3.67 },
  { code: "UZS", name: "Uzbekistan Som", symbol: "so'm", rate: 12800 },
  { code: "VND", name: "Vietnamese Dong", symbol: "₫", rate: 25400 },
  /** OpenPay special — π per $1, refreshed from CoinGecko */
  { code: "PI", name: "Pi", symbol: "π", rate: 1 / 0.079 },
];

/** @deprecated use string codes from CURRENCIES — kept for gradual migration */
export type CurrencyCode = string;

const STORAGE_KEY = "op:currency";
const RATES_CACHE_KEY = "op:fx-rates-usd";
const RATES_TTL_MS = 60 * 60 * 1000;

let liveRates: Record<string, number> | null = null;
let ratesFetchedAt = 0;
let ratesPromise: Promise<Record<string, number>> | null = null;

function piPerUsd(): number {
  const usd = getCachedPiUsdPrice();
  return usd > 0 ? 1 / usd : CURRENCIES.find((c) => c.code === "PI")!.rate;
}

export function getCurrencyMeta(code: string): CurrencyMeta {
  return CURRENCIES.find((c) => c.code === code) ?? CURRENCIES[0]!;
}

export function isKnownCurrency(code: string): boolean {
  return CURRENCIES.some((c) => c.code === code);
}

export function currencyListLabel(c: CurrencyMeta): string {
  return `${c.code} - ${c.name} (${c.symbol})`;
}

/** Units of `code` per 1 USD. */
export function getUsdRate(code: string): number {
  if (code === "USD") return 1;
  if (code === "PI") return piPerUsd();
  const live = liveRates?.[code.toLowerCase()];
  if (typeof live === "number" && live > 0) return live;
  return getCurrencyMeta(code).rate;
}

function loadCachedRates(): Record<string, number> | null {
  try {
    const raw = localStorage.getItem(RATES_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { at: number; rates: Record<string, number> };
    if (!parsed?.rates || Date.now() - parsed.at > RATES_TTL_MS) return null;
    return parsed.rates;
  } catch {
    return null;
  }
}

function saveCachedRates(rates: Record<string, number>) {
  try {
    localStorage.setItem(RATES_CACHE_KEY, JSON.stringify({ at: Date.now(), rates }));
  } catch {
    /* ignore */
  }
}

/** Fetch / refresh USD→fiat rates. Safe to call often (deduped + cached). */
export async function fetchFxRates(): Promise<Record<string, number>> {
  if (liveRates && Date.now() - ratesFetchedAt < RATES_TTL_MS) return liveRates;
  if (typeof window !== "undefined" && !liveRates) {
    const cached = loadCachedRates();
    if (cached) {
      liveRates = cached;
      ratesFetchedAt = Date.now();
    }
  }
  if (ratesPromise) return ratesPromise;

  ratesPromise = (async () => {
    const urls = [
      "https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/usd.min.json",
      "https://latest.currency-api.pages.dev/v1/currencies/usd.min.json",
    ];
    for (const url of urls) {
      try {
        const res = await fetch(url);
        if (!res.ok) continue;
        const json = (await res.json()) as { usd?: Record<string, number> };
        const usd = json.usd;
        if (!usd || typeof usd !== "object") continue;
        liveRates = usd;
        ratesFetchedAt = Date.now();
        if (typeof window !== "undefined") saveCachedRates(usd);
        return usd;
      } catch {
        /* try next */
      }
    }
    return liveRates ?? {};
  })().finally(() => {
    ratesPromise = null;
  });

  return ratesPromise;
}

export function formatCurrency(
  usd: number,
  code: CurrencyCode = "USD",
  opts: { compact?: boolean } = {},
): string {
  const c = getCurrencyMeta(code);
  const rate = getUsdRate(code);
  const value = Number(usd || 0) * rate;
  if (!Number.isFinite(value)) return code === "PI" ? `${c.symbol}0.00` : "$0.00";

  const abs = Math.abs(value);
  const useCompact = opts.compact !== false && abs >= 1_000_000;

  if (code === "PI") {
    if (useCompact) {
      return `${c.symbol}${new Intl.NumberFormat("en-US", {
        notation: "compact",
        maximumFractionDigits: 2,
      }).format(value)}`;
    }
    return `${c.symbol}${new Intl.NumberFormat("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value)}`;
  }

  // Zero-decimal / large-unit currencies look better without cents
  const zeroDecimal = ["JPY", "KRW", "VND", "IDR", "CLP", "COP", "UZS"].includes(code);
  const maxFrac = zeroDecimal ? 0 : 2;
  const minFrac = zeroDecimal ? 0 : 2;

  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: code,
      notation: useCompact ? "compact" : "standard",
      minimumFractionDigits: useCompact ? 0 : minFrac,
      maximumFractionDigits: useCompact ? 2 : maxFrac,
    }).format(value);
  } catch {
    return `${c.symbol}${value.toFixed(minFrac)}`;
  }
}

/**
 * Phantom-style unit price: extra digits for sub-cent tokens, ellipsis when truncated.
 */
export function formatTokenPrice(
  usd: number,
  code: CurrencyCode = "USD",
  opts: { maxLen?: number } = {},
): string {
  const c = getCurrencyMeta(code);
  const rate = getUsdRate(code);
  const value = Number(usd || 0) * rate;
  if (!Number.isFinite(value) || value === 0) return `${c.symbol}0.00`;

  const abs = Math.abs(value);
  let maxFrac = 2;
  if (abs < 0.000001) maxFrac = 10;
  else if (abs < 0.0001) maxFrac = 8;
  else if (abs < 0.01) maxFrac = 6;
  else if (abs < 1) maxFrac = 5;
  else maxFrac = 2;

  const body = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: abs >= 1 ? 2 : Math.min(2, maxFrac),
    maximumFractionDigits: maxFrac,
    useGrouping: abs >= 1_000,
  }).format(value);

  const full = `${c.symbol}${body}`;
  const maxLen = opts.maxLen ?? 10;
  if (full.length > maxLen) return `${full.slice(0, maxLen - 1)}…`;
  return full;
}

export function useCurrency() {
  const [code, setCode] = useState<CurrencyCode>("USD");
  const [, setTick] = useState(0);

  useEffect(() => {
    const saved =
      typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;
    if (saved && isKnownCurrency(saved)) setCode(saved);
  }, []);

  useEffect(() => {
    void Promise.all([fetchFxRates(), fetchMajorUsdPrices(["pi"])]).then(() =>
      setTick((n) => n + 1),
    );
  }, []);

  const update = (next: CurrencyCode) => {
    if (!isKnownCurrency(next)) return;
    setCode(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* ignore */
    }
    window.dispatchEvent(new CustomEvent("op:currency-change", { detail: next }));
  };

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as CurrencyCode;
      if (detail && detail !== code && isKnownCurrency(detail)) setCode(detail);
    };
    window.addEventListener("op:currency-change", handler);
    return () => window.removeEventListener("op:currency-change", handler);
  }, [code]);

  const cycle = () => {
    const idx = CURRENCIES.findIndex((c) => c.code === code);
    update(CURRENCIES[(idx + 1) % CURRENCIES.length]!.code);
  };

  return { code, setCode: update, cycle, meta: getCurrencyMeta(code) };
}

export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
