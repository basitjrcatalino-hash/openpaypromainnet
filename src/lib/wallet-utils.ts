// Tiny mock helpers – not real cryptography. Used to simulate wallet creation.
export function generateAddress(prefix = "0x"): string {
  const hex = "0123456789abcdef";
  let s = "";
  for (let i = 0; i < 40; i++) s += hex[Math.floor(Math.random() * 16)];
  return prefix + s;
}

const WORDS = [
  "abandon","ability","able","about","above","absent","absorb","abstract","absurd","abuse",
  "access","accident","account","accuse","achieve","acid","acoustic","acquire","across","act",
  "action","actor","actress","actual","adapt","add","addict","address","adjust","admit",
  "adult","advance","advice","aerobic","affair","afford","afraid","again","age","agent",
  "agree","ahead","aim","air","airport","aisle","alarm","album","alcohol","alert",
];

export function generateMnemonic(words = 12): string[] {
  const out: string[] = [];
  while (out.length < words) {
    const w = WORDS[Math.floor(Math.random() * WORDS.length)];
    out.push(w);
  }
  return out;
}

export function shortAddress(addr?: string | null, head = 6, tail = 4): string {
  if (!addr) return "—";
  if (addr.length <= head + tail + 2) return addr;
  return `${addr.slice(0, head)}…${addr.slice(-tail)}`;
}

export function formatUSD(n: number | string | null | undefined, opts: { compact?: boolean } = {}): string {
  const v = typeof n === "string" ? parseFloat(n) : n ?? 0;
  if (!isFinite(v)) return "$0.00";
  const abs = Math.abs(v);
  const useCompact = opts.compact === true || (opts.compact !== false && abs >= 1_000_000);
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: useCompact ? "compact" : "standard",
    minimumFractionDigits: useCompact ? 0 : 2,
    maximumFractionDigits: v < 1 && !useCompact ? 4 : 2,
  }).format(v);
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

export function formatPct(n: number | string | null | undefined): string {
  const v = typeof n === "string" ? parseFloat(n) : n ?? 0;
  const sign = v > 0 ? "+" : "";
  return `${sign}${v.toFixed(2)}%`;
}
