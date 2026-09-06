/** Shared constants for OUSD payouts to a Pi Network wallet (client-safe). */

export const PI_WALLET_RE = /^G[A-Z2-7]{55}$/;

export const PI_PAYOUT_MIN_OUSD = 10;
export const PI_PAYOUT_MAX_OUSD = 1_000_000;

export const PI_TRUSTLINE_MSG =
  "Add OpenUSD (OUSD) in Pi Wallet first: Tokens → enable OUSD issued by OpenPay, then try again.";

export function isValidPiWalletAddress(raw: string): boolean {
  return PI_WALLET_RE.test(String(raw || "").trim().toUpperCase().replace(/\s+/g, ""));
}

export function normalizePiWalletAddress(raw: string): string {
  return String(raw || "").trim().toUpperCase().replace(/\s+/g, "");
}

/** Short display form: GABCDE…WXYZ */
export function formatPiWalletPreview(raw: string): string {
  const addr = normalizePiWalletAddress(raw);
  return isValidPiWalletAddress(addr) ? `${addr.slice(0, 6)}…${addr.slice(-4)}` : "";
}

/** Inline validation copy; empty string means "no error yet". */
export function getPiWalletError(raw: string): string {
  const cleaned = String(raw || "").trim();
  if (!cleaned) return "";
  if (isValidPiWalletAddress(cleaned)) return "";
  if (cleaned.toUpperCase().startsWith("G"))
    return "Enter a full Pi Wallet address (56 characters, starts with G).";
  return "Paste a Pi Wallet address from Pi Wallet → Receive.";
}

/** Extract a G-address from QR payloads: stellar:/pi: URIs, JSON, URLs, or bare text. */
export function extractPiWalletFromQr(raw: string): string {
  const text = String(raw || "").trim();
  if (!text) return "";
  const pick = (value: string | null | undefined) => {
    const cleaned = normalizePiWalletAddress(String(value || ""));
    return isValidPiWalletAddress(cleaned) ? cleaned : "";
  };
  const uri = text.match(/(?:stellar|pi):([A-Za-z2-7]{56})/i);
  if (uri?.[1]) {
    const found = pick(uri[1]);
    if (found) return found;
  }
  const bare = pick(text);
  if (bare) return bare;
  try {
    const parsed = JSON.parse(text) as Record<string, unknown>;
    for (const key of ["address", "publicKey", "public_key", "account", "wallet", "to", "destination"]) {
      const found = pick(typeof parsed[key] === "string" ? (parsed[key] as string) : "");
      if (found) return found;
    }
  } catch {
    /* not JSON */
  }
  try {
    const url = new URL(text);
    for (const key of ["wallet", "address", "to", "account", "dest", "destination", "publicKey"]) {
      const found = pick(url.searchParams.get(key));
      if (found) return found;
    }
    const pathG = url.pathname.split("/").find((p) => isValidPiWalletAddress(p));
    if (pathG) return normalizePiWalletAddress(pathG);
  } catch {
    /* not a URL */
  }
  const anyG = text.toUpperCase().match(/G[A-Z2-7]{55}/);
  return anyG && isValidPiWalletAddress(anyG[0]) ? anyG[0] : "";
}

const PI_EXPLORER_MAINNET = "https://blockexplorer.minepi.com/mainnet";
const PI_EXPLORER_TESTNET = "https://blockexplorer.minepi.com/testnet";

/** Pi block explorer link for a submitted transaction hash. */
export function piTxExplorerUrl(txid: string, horizon?: string | null): string {
  const hash = String(txid || "").trim().replace(/^0x/i, "");
  if (!hash) return "";
  const base = /testnet/i.test(String(horizon || "")) ? PI_EXPLORER_TESTNET : PI_EXPLORER_MAINNET;
  return `${base}/transactions/${hash}`;
}
