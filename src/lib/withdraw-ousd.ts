/** Platform OUSD withdrawal treasury / fee address (@openpay). */
export const WITHDRAWAL_TREASURY_USERNAME = "openpay";
export const WITHDRAWAL_TREASURY_ADDRESS =
  "0x30d908ac9df497fbe1934c47c0a90cb38107985d";

/** Same wallet receives the 2% withdrawal fee. */
export const WITHDRAWAL_FEE_ADDRESS = WITHDRAWAL_TREASURY_ADDRESS;
export const WITHDRAWAL_FEE_BPS = 200; // 2.00%

export const WITHDRAWAL_MIN_OUSD = 10;

export type WithdrawalStatus = "pending" | "completed" | "rejected" | "cancelled";

/** Destination rail: Pi Network wallet or OpenPay account (OP…). */
export type WithdrawalDestKind = "pi" | "openpay";

export const WITHDRAWAL_DEST_KINDS: {
  id: WithdrawalDestKind;
  label: string;
  hint: string;
  placeholder: string;
}[] = [
  {
    id: "pi",
    label: "Pi",
    hint: "Pi mainnet wallet (G… address)",
    placeholder: "G… Pi wallet address",
  },
  {
    id: "openpay",
    label: "OpenPay",
    hint: "OpenPay account address (starts with OP)",
    placeholder: "OPxxxxxxxx",
  },
];

function round8(n: number) {
  return Math.round(n * 1e8) / 1e8;
}

/** Split gross withdrawal into 2% fee + net payout. */
export function calcWithdrawalFee(
  amount: number,
  feeBps = WITHDRAWAL_FEE_BPS,
): { fee: number; net: number; feeBps: number; feePercent: number } {
  if (!Number.isFinite(amount) || amount <= 0) {
    return { fee: 0, net: 0, feeBps, feePercent: feeBps / 100 };
  }
  const fee = round8((amount * feeBps) / 10_000);
  const net = round8(Math.max(0, amount - fee));
  return { fee, net, feeBps, feePercent: feeBps / 100 };
}

const PI_ADDR_RE = /^G[A-Z2-7]{55}$/;
const OPENPAY_OP_RE = /^OP[A-Za-z0-9]{4,64}$/i;

export function isValidPiDestination(raw: string): boolean {
  const t = raw.trim();
  if (!t) return false;
  if (PI_ADDR_RE.test(t)) return true;
  // Some Pi wallets paste longer mainnet ids
  if (/^[A-Z0-9]{20,128}$/i.test(t) && !t.startsWith("0x") && !/^OP/i.test(t)) return true;
  return false;
}

export function isValidOpenPayDestination(raw: string): boolean {
  const t = raw.trim();
  if (!t) return false;
  return OPENPAY_OP_RE.test(t);
}

export function isValidDestinationAddress(
  raw: string,
  kind?: WithdrawalDestKind | null,
): boolean {
  if (kind === "pi") return isValidPiDestination(raw);
  if (kind === "openpay") return isValidOpenPayDestination(raw);
  return isValidPiDestination(raw) || isValidOpenPayDestination(raw);
}

export function detectDestinationKind(raw: string): WithdrawalDestKind | null {
  const t = raw.trim();
  if (!t) return null;
  if (isValidOpenPayDestination(t)) return "openpay";
  if (isValidPiDestination(t)) return "pi";
  return null;
}

export function extractAddressFromScan(text: string): string {
  const raw = text.trim();
  if (!raw) return "";
  try {
    if (raw.includes("://") || raw.startsWith("http")) {
      const u = new URL(raw.includes("://") ? raw : `https://${raw}`);
      const q =
        u.searchParams.get("address") ||
        u.searchParams.get("to") ||
        u.searchParams.get("recipient") ||
        u.searchParams.get("wallet") ||
        u.searchParams.get("account");
      if (q) return q.trim();
      const pathSeg = u.pathname.split("/").filter(Boolean).pop();
      if (pathSeg && isValidDestinationAddress(pathSeg)) return pathSeg.trim();
    }
  } catch {
    /* plain text */
  }
  const m = raw.match(/(OP[A-Za-z0-9]{4,64}|G[A-Z2-7]{55}|0x[a-fA-F0-9]{40})/i);
  if (m) return m[1];
  return raw;
}
