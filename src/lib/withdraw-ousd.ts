/** Platform OUSD withdrawal treasury (@openpay). */
export const WITHDRAWAL_TREASURY_USERNAME = "openpay";
export const WITHDRAWAL_TREASURY_ADDRESS =
  "0x30d908ac9df497fbe1934c47c0a90cb38107985d";

export const WITHDRAWAL_MIN_OUSD = 10;

export type WithdrawalStatus = "pending" | "completed" | "rejected" | "cancelled";

export function isValidDestinationAddress(raw: string): boolean {
  const t = raw.trim();
  if (!t) return false;
  // OpenPay / EVM
  if (/^0x[a-fA-F0-9]{40}$/.test(t)) return true;
  // Pi / Stellar-style
  if (/^G[A-Z2-7]{55}$/.test(t)) return true;
  // Generic mainnet wallet (allow paste of other formats)
  if (/^[a-zA-Z0-9:._-]{20,128}$/.test(t) && !/\s/.test(t)) return true;
  return false;
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
        u.searchParams.get("wallet");
      if (q) return q.trim();
      const pathSeg = u.pathname.split("/").filter(Boolean).pop();
      if (pathSeg && isValidDestinationAddress(pathSeg)) return pathSeg.trim();
    }
  } catch {
    /* plain text */
  }
  // openpay://pay?to=0x… or similar
  const m = raw.match(/(0x[a-fA-F0-9]{40}|G[A-Z2-7]{55})/);
  if (m) return m[1];
  return raw;
}
