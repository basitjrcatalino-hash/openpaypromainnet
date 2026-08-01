/**
 * OpenPay Pro ledger helpers.
 * Recovery phrases are app-level secrets: same phrase → same recovery_hash → same
 * ledger row (address + balances). Not BIP39 / chain keypairs.
 */

import { formatCurrency, getDisplayCurrencyCode } from "@/lib/currency";

const WORDS = [
  "abandon", "ability", "able", "about", "above", "absent", "absorb", "abstract", "absurd", "abuse",
  "access", "accident", "account", "accuse", "achieve", "acid", "acoustic", "acquire", "across", "act",
  "action", "actor", "actress", "actual", "adapt", "add", "addict", "address", "adjust", "admit",
  "adult", "advance", "advice", "aerobic", "affair", "afford", "afraid", "again", "age", "agent",
  "agree", "ahead", "aim", "air", "airport", "aisle", "alarm", "album", "alcohol", "alert",
  "alien", "all", "alley", "allow", "almost", "alone", "alpha", "already", "also", "alter",
  "always", "amateur", "amazing", "among", "amount", "amused", "analyst", "anchor", "ancient", "anger",
  "angle", "angry", "animal", "ankle", "announce", "annual", "another", "answer", "antenna", "antique",
];

export function generateAddress(prefix = "0x"): string {
  const hex = "0123456789abcdef";
  let s = "";
  for (let i = 0; i < 40; i++) s += hex[Math.floor(Math.random() * 16)];
  return prefix + s;
}

export function generateMnemonic(words = 12): string[] {
  const out: string[] = [];
  const used = new Set<string>();
  while (out.length < words) {
    const w = WORDS[Math.floor(Math.random() * WORDS.length)];
    if (used.has(w)) continue;
    used.add(w);
    out.push(w);
  }
  return out;
}

export function normalizeMnemonic(input: string | string[]): string[] {
  const raw = Array.isArray(input) ? input.join(" ") : input;
  return raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

export function isValidMnemonicLength(words: string[]): boolean {
  return words.length === 12 || words.length === 24;
}

export async function sha256Hex(text: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Stable secret fingerprint — never store the plaintext phrase in the DB. */
export async function recoveryHashFromPhrase(phrase: string | string[]): Promise<string> {
  const words = normalizeMnemonic(phrase);
  return sha256Hex(`openpay-pro-recovery:v1:${words.join(" ")}`);
}

/** Deterministic OpenPay Pro address derived from the recovery hash. */
export async function addressFromRecoveryHash(recoveryHash: string, prefix = "0x"): Promise<string> {
  const derived = await sha256Hex(`openpay-pro-address:v1:${recoveryHash.toLowerCase()}`);
  return `${prefix}${derived.slice(0, 40)}`;
}

export type DerivedOpenPayWallet = {
  words: string[];
  phrase: string;
  recovery_hash: string;
  address: string;
};

export async function deriveWalletFromPhrase(
  phrase: string | string[],
): Promise<DerivedOpenPayWallet> {
  const words = normalizeMnemonic(phrase);
  if (!isValidMnemonicLength(words)) {
    throw new Error("Enter a valid 12- or 24-word recovery phrase");
  }
  const recovery_hash = await recoveryHashFromPhrase(words);
  const address = await addressFromRecoveryHash(recovery_hash);
  return { words, phrase: words.join(" "), recovery_hash, address };
}

export async function createFreshRecoveryWallet(): Promise<DerivedOpenPayWallet> {
  return deriveWalletFromPhrase(generateMnemonic(12));
}

const PHRASE_SESSION_PREFIX = "opp:recovery:";

export function stashRecoveryPhrase(walletId: string, phrase: string) {
  try {
    sessionStorage.setItem(`${PHRASE_SESSION_PREFIX}${walletId}`, phrase);
  } catch {
    /* ignore */
  }
}

export function peekRecoveryPhrase(walletId: string): string | null {
  try {
    return sessionStorage.getItem(`${PHRASE_SESSION_PREFIX}${walletId}`);
  } catch {
    return null;
  }
}

export function clearRecoveryPhrase(walletId: string) {
  try {
    sessionStorage.removeItem(`${PHRASE_SESSION_PREFIX}${walletId}`);
  } catch {
    /* ignore */
  }
}

export function shortAddress(addr?: string | null, head = 6, tail = 4): string {
  if (!addr) return "—";
  if (addr.length <= head + tail + 2) return addr;
  return `${addr.slice(0, head)}…${addr.slice(-tail)}`;
}

/** Format a USD-denominated value in the user's Phantom-style display currency. */
export function formatUSD(n: number | string | null | undefined, opts: { compact?: boolean } = {}): string {
  const v = typeof n === "string" ? parseFloat(n) : n ?? 0;
  if (!isFinite(v)) return formatCurrency(0, getDisplayCurrencyCode(), opts);
  return formatCurrency(v, getDisplayCurrencyCode(), opts);
}

/**
 * Format amounts denominated in OUSD (1 OUSD ≈ $1).
 * Token units stay in OUSD — they do not convert with display currency.
 * Use formatUSD for fiat equivalents of those balances.
 */
export function formatOUSD(
  n: number | string | null | undefined,
  opts: { compact?: boolean; price?: boolean; suffix?: boolean } = {},
): string {
  const v = typeof n === "string" ? parseFloat(n) : n ?? 0;
  const withSuffix = opts.suffix !== false;
  if (!isFinite(v)) return withSuffix ? "0 OUSD" : "0";
  const abs = Math.abs(v);
  const asPrice = opts.price === true || (abs > 0 && abs < 0.01 && opts.compact !== true);
  const body = asPrice
    ? formatNumber(v, abs < 0.01 ? 8 : 4)
    : formatNumber(v, 2, { compact: opts.compact });
  return withSuffix ? `${body} OUSD` : body;
}

export function formatNumber(
  n: number | string | null | undefined,
  decimals = 4,
  opts: { compact?: boolean } = {},
): string {
  const v = typeof n === "string" ? parseFloat(n) : n ?? 0;
  if (!isFinite(v)) return "0";
  const abs = Math.abs(v);
  const useCompact = opts.compact === true || (opts.compact !== false && abs >= 1_000_000);
  return new Intl.NumberFormat("en-US", {
    notation: useCompact ? "compact" : "standard",
    minimumFractionDigits: 0,
    maximumFractionDigits: useCompact ? 2 : decimals,
  }).format(v);
}

/** Phantom-style % change: +/− sign, grouping for large moves (e.g. +1,131%). */
export function formatPct(n: number | string | null | undefined): string {
  const v = typeof n === "string" ? parseFloat(n) : Number(n ?? 0);
  if (!Number.isFinite(v)) return "0.00%";
  const abs = Math.abs(v);
  const digits = abs >= 100 ? 0 : abs >= 10 ? 1 : 2;
  const body = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(abs);
  if (v > 0) return `+${body}%`;
  if (v < 0) return `-${body}%`;
  return `${body}%`;
}

export function timeAgo(date: string | Date | null | undefined): string {
  if (!date) return "";
  const t = typeof date === "string" ? new Date(date).getTime() : date.getTime();
  if (!isFinite(t)) return "";
  const s = Math.max(0, Math.floor((Date.now() - t) / 1000));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 48) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d`;
  return `${Math.floor(d / 30)}mo`;
}

/** Supabase-compatible client shape for wallet lookups. */
type WalletQueryClient = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  from: (table: string) => any;
};

function isMissingRemovedAtColumn(message?: string | null): boolean {
  const m = (message || "").toLowerCase();
  return m.includes("removed_at") && (m.includes("column") || m.includes("schema") || m.includes("does not exist"));
}

/**
 * List a user's wallets. Filters soft-removed rows when `removed_at` exists;
 * falls back cleanly before that migration is applied.
 */
export async function listUserWallets<T = Record<string, unknown>>(
  supabase: WalletQueryClient,
  userId: string,
  columns = "id,user_id,name,address,is_active,ousd_balance,pi_balance,btc_balance,eth_balance,sol_balance,usdc_balance,usdt_balance,pyusd_balance,usdg_balance,usd1_balance,cash_balance,eurc_balance,hype_balance,zec_balance,tslax_balance,nflxx_balance,googlx_balance,created_at",
): Promise<T[]> {
  const primary = await supabase
    .from("wallets")
    .select(columns)
    .eq("user_id", userId)
    .is("removed_at", null)
    .order("is_active", { ascending: false })
    .order("created_at", { ascending: true });

  if (!primary.error) return (primary.data as T[]) ?? [];

  if (!isMissingRemovedAtColumn(primary.error.message)) {
    throw new Error(primary.error.message);
  }

  const fallback = await supabase
    .from("wallets")
    .select(columns)
    .eq("user_id", userId)
    .order("is_active", { ascending: false })
    .order("created_at", { ascending: true });

  if (fallback.error) throw new Error(fallback.error.message);
  return (fallback.data as T[]) ?? [];
}

/**
 * Load the user's activated wallet (is_active first). Never use bare limit(1)
 * without this order — Postgres can return a different wallet and top-ups
 * would credit the wrong account.
 */
export async function fetchActiveWallet<T = Record<string, unknown>>(
  supabase: WalletQueryClient,
  userId: string,
  columns = "*",
): Promise<T | null> {
  const rows = await listUserWallets<T>(supabase, userId, columns);
  return rows[0] ?? null;
}

/** Resolve a wallet the user owns, preferring an explicit id then the active one. */
export async function resolveCreditWallet<T extends { id: string } = { id: string } & Record<string, unknown>>(
  supabase: WalletQueryClient,
  userId: string,
  walletId?: string | null,
): Promise<T | null> {
  if (walletId) {
    const withFilter = await supabase
      .from("wallets")
      .select("*")
      .eq("id", walletId)
      .eq("user_id", userId)
      .is("removed_at", null)
      .maybeSingle();

    if (!withFilter.error && withFilter.data) return withFilter.data as T;

    if (withFilter.error && !isMissingRemovedAtColumn(withFilter.error.message)) {
      throw new Error(withFilter.error.message);
    }

    const fallback = await supabase
      .from("wallets")
      .select("*")
      .eq("id", walletId)
      .eq("user_id", userId)
      .maybeSingle();
    if (fallback.error) throw new Error(fallback.error.message);
    if (fallback.data) return fallback.data as T;
  }
  return fetchActiveWallet<T>(supabase, userId);
}

