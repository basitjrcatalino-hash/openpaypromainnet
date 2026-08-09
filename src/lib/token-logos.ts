import { MAJOR_TOKEN_IDS, MAJOR_TOKENS } from "@/lib/major-tokens";
import ousdLogo from "@/assets/ousd-logo.png.asset.json";

/** Official OUSD token mark */
export const OUSD_LOGO_URL = ousdLogo.url;


/** Local SVG fallback if the remote mark is unavailable */
export const OUSD_LOGO_FALLBACK_URL = "/ousd-logo.svg";

/** OpenPay network badge (ape + O mark) for token list overlays */
export const OPENPAY_NETWORK_BADGE_URL =
  "https://i.ibb.co/vxtrzQTD/photo-2026-07-08-11-03-07-removebg-preview-1.png";

/** Official Pi Network mark for payment method rows */
export const PI_NETWORK_LOGO_URL =
  "https://i.ibb.co/v6L6pWbf/pi-network-lvquy-logo-png-seeklogo-440686.png";

/** USDC mark for payment method rows */
export const USDC_LOGO_URL =
  "https://assets.coingecko.com/coins/images/6319/large/usdc.png";

/** USDT mark for payment method rows */
export const USDT_LOGO_URL =
  "https://assets.coingecko.com/coins/images/325/large/Tether.png";

/** SOL mark for payment method rows */
export const SOL_LOGO_URL =
  "https://assets.coingecko.com/coins/images/4128/large/solana.png";

/** Canonical logos for ledger majors + OUSD (history, notifications, pickers). */
function buildKnownTokenLogos(): Record<string, string> {
  const logos: Record<string, string> = {
    OUSD: OUSD_LOGO_URL,
    OPENUSD: OUSD_LOGO_URL,
    OPENPAY: OUSD_LOGO_URL,
  };

  for (const id of MAJOR_TOKEN_IDS) {
    const def = MAJOR_TOKENS[id];
    const logo = def.logoUrl;
    if (!logo) continue;
    logos[def.symbol.toUpperCase()] = logo;
    logos[def.name.toUpperCase()] = logo;
    logos[def.name.toUpperCase().replace(/\s+/g, "")] = logo;
  }

  // Prefer OpenPay/Pi brand marks where they exist.
  logos.PI = PI_NETWORK_LOGO_URL;
  logos.PINETWORK = PI_NETWORK_LOGO_URL;
  logos["PI NETWORK"] = PI_NETWORK_LOGO_URL;
  logos.USDC = USDC_LOGO_URL;
  logos.USDCOIN = USDC_LOGO_URL;
  logos["USD COIN"] = USDC_LOGO_URL;
  logos.USDT = USDT_LOGO_URL;
  logos.TETHER = USDT_LOGO_URL;
  logos.SOL = SOL_LOGO_URL;
  logos.SOLANA = SOL_LOGO_URL;

  return logos;
}

const KNOWN_TOKEN_LOGOS = buildKnownTokenLogos();

function normalizeSymbolToken(raw: string): string {
  return raw
    .trim()
    .replace(/^\$/, "")
    .replace(/\s+/g, " ")
    .toUpperCase();
}

/**
 * Resolve a logo URL from a transaction token_symbol.
 * Handles plain symbols (BTC), OpenToken `$TICKER`, and swap pairs (`OUSD→BTC`).
 */
export function logoUrlForTokenSymbol(symbol: string | null | undefined): string | null {
  if (!symbol) return null;
  const raw = symbol.trim();
  if (!raw) return null;

  // Swap / pair labels: prefer the "to" side, then the "from" side
  const parts = raw.split(/→|->|\/|➜/).map(normalizeSymbolToken).filter(Boolean);
  const candidates = parts.length > 1 ? [...parts].reverse() : [normalizeSymbolToken(raw)];

  for (const c of candidates) {
    if (KNOWN_TOKEN_LOGOS[c]) return KNOWN_TOKEN_LOGOS[c];
    // "PI NETWORK" style already covered; also try first word
    const first = c.split(" ")[0];
    if (first && KNOWN_TOKEN_LOGOS[first]) return KNOWN_TOKEN_LOGOS[first];
  }
  return null;
}

/** Prefer an explicit logo, else fall back to known symbol marks. */
export function resolveTokenLogoUrl(
  logoUrl: string | null | undefined,
  symbol?: string | null,
): string | null {
  if (logoUrl) return logoUrl;
  return logoUrlForTokenSymbol(symbol);
}

/** Symbols that already have a built-in logo (skip OpenToken DB lookup). */
export function isKnownTokenLogoSymbol(symbol: string | null | undefined): boolean {
  if (!symbol) return false;
  const key = normalizeSymbolToken(symbol);
  if (KNOWN_TOKEN_LOGOS[key]) return true;
  const first = key.split(" ")[0];
  return Boolean(first && KNOWN_TOKEN_LOGOS[first]);
}
