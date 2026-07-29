/** Official OpenPay / OUSD brand mark */
export const OUSD_LOGO_URL = "https://i.ibb.co/DPYPzVdN/app-icon-ios.png";

/** Local SVG fallback if the remote mark is unavailable */
export const OUSD_LOGO_FALLBACK_URL = "/ousd-logo.svg";

/** OpenPay network badge (ape + O mark) for token list overlays */
export const OPENPAY_NETWORK_BADGE_URL =
  "https://i.ibb.co/vxtrzQTD/photo-2026-07-08-11-03-07-removebg-preview-1.png";

/** Official Pi Network mark for payment method rows */
export const PI_NETWORK_LOGO_URL =
  "https://i.ibb.co/v6L6pWbf/pi-network-lvquy-logo-png-seeklogo-440686.png";

/** Canonical logos for ledger majors + OUSD (history, pickers, fallbacks). */
const KNOWN_TOKEN_LOGOS: Record<string, string> = {
  OUSD: OUSD_LOGO_URL,
  OPENUSD: OUSD_LOGO_URL,
  OPENPAY: OUSD_LOGO_URL,
  BTC: "https://assets.coingecko.com/coins/images/1/large/bitcoin.png",
  BITCOIN: "https://assets.coingecko.com/coins/images/1/large/bitcoin.png",
  ETH: "https://assets.coingecko.com/coins/images/279/large/ethereum.png",
  ETHEREUM: "https://assets.coingecko.com/coins/images/279/large/ethereum.png",
  SOL: "https://assets.coingecko.com/coins/images/4128/large/solana.png",
  SOLANA: "https://assets.coingecko.com/coins/images/4128/large/solana.png",
  USDC: "https://assets.coingecko.com/coins/images/6319/large/usdc.png",
  USDCOIN: "https://assets.coingecko.com/coins/images/6319/large/usdc.png",
  "USD COIN": "https://assets.coingecko.com/coins/images/6319/large/usdc.png",
  USDT: "https://assets.coingecko.com/coins/images/325/large/Tether.png",
  TETHER: "https://assets.coingecko.com/coins/images/325/large/Tether.png",
  PI: PI_NETWORK_LOGO_URL,
  PINETWORK: PI_NETWORK_LOGO_URL,
  "PI NETWORK": PI_NETWORK_LOGO_URL,
};

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
