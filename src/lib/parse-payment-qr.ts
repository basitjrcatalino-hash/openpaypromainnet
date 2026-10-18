import { isLedgerAssetCode, type LedgerAssetCode } from "@/lib/ledger-majors";

export type ParsedPaymentQr = {
  to: string;
  amount?: string;
  asset?: LedgerAssetCode;
  /** OpenToken uuid when QR targets a specific OpenPay token. */
  token?: string;
  /** Which send rail this QR should use. */
  rail: "wallet" | "openpay";
  kind: "pro_wallet" | "openpay_account" | "unknown";
};

const PRO_ADDR_RE = /^0x[a-fA-F0-9]{40}$/;
const PRO_ADDR_EMBEDDED_RE = /0x[a-fA-F0-9]{40}/i;
const OP_ACCOUNT_RE = /^OP[A-Za-z0-9]{4,}$/i;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function classifyRecipient(to: string): Pick<ParsedPaymentQr, "rail" | "kind"> {
  const t = to.trim();
  if (!t) return { rail: "wallet", kind: "unknown" };
  if (PRO_ADDR_RE.test(t)) return { rail: "wallet", kind: "pro_wallet" };
  if (OP_ACCOUNT_RE.test(t) || EMAIL_RE.test(t) || t.startsWith("@")) {
    return { rail: "openpay", kind: "openpay_account" };
  }
  // Bare username (no 0x) → OpenPay / local @handle
  if (/^[a-zA-Z0-9_.-]{3,30}$/.test(t) && !t.startsWith("0x")) {
    return { rail: "openpay", kind: "openpay_account" };
  }
  return { rail: "wallet", kind: "unknown" };
}

function parseAsset(raw: string | null): LedgerAssetCode | undefined {
  if (!raw) return undefined;
  const up = raw.toUpperCase();
  return isLedgerAssetCode(up) ? up : undefined;
}

function fromParts(
  toRaw: string,
  amount?: string | null,
  assetRaw?: string | null,
  tokenRaw?: string | null,
): ParsedPaymentQr {
  let to = toRaw.trim().replace(/^@+/, "").replace(/^\/+/, "");
  // Recover address if path/query glued junk around a Pro wallet.
  if (!PRO_ADDR_RE.test(to)) {
    const embedded = to.match(PRO_ADDR_EMBEDDED_RE)?.[0];
    if (embedded) to = embedded;
  }
  const amountClean = amount?.trim() || undefined;
  const asset = parseAsset(assetRaw ?? null);
  const token =
    tokenRaw &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      tokenRaw.trim(),
    )
      ? tokenRaw.trim()
      : undefined;
  const cls = classifyRecipient(to);
  return {
    to,
    amount: amountClean,
    asset,
    token,
    ...cls,
  };
}

/** Pull a Pro wallet address out of arbitrary QR text / URLs. */
function extractProAddress(raw: string): string | null {
  const m = raw.replace(/\s/g, "").match(PRO_ADDR_EMBEDDED_RE);
  return m ? m[0] : null;
}

/** Extract payee from OpenPay / OpenPay Pro web pay links. */
function parseHttpPayUrl(raw: string): ParsedPaymentQr | null {
  try {
    const url = new URL(raw.includes("://") ? raw : `https://${raw}`);
    const path = decodeURIComponent(url.pathname);

    // https://openpaypro.space/pay/0x…?asset=OUSD
    // https://any-host/pay/0x… (preview / custom domains)
    // https://openpy.space/pay/@alice?amount=10
    const payMatch = path.match(/\/pay\/([^/?#]+)/i);
    if (payMatch?.[1]) {
      const handle = decodeURIComponent(payMatch[1]).replace(/^@+/, "");
      return fromParts(
        handle,
        url.searchParams.get("amount") ?? url.searchParams.get("value"),
        url.searchParams.get("asset") ?? "OUSD",
        url.searchParams.get("token"),
      );
    }

    // Query-style: /send?to=0x… | ?address= | ?account=OP… | ?username=
    const toParam =
      url.searchParams.get("to") ||
      url.searchParams.get("address") ||
      url.searchParams.get("account") ||
      url.searchParams.get("username") ||
      url.searchParams.get("recipient");
    if (toParam) {
      return fromParts(
        toParam,
        url.searchParams.get("amount") ?? url.searchParams.get("value"),
        url.searchParams.get("asset"),
        url.searchParams.get("token"),
      );
    }

    // Last resort: any 0x in the URL (broken / truncated pay links)
    const embedded = extractProAddress(url.href);
    if (embedded) {
      return fromParts(
        embedded,
        url.searchParams.get("amount") ?? url.searchParams.get("value"),
        url.searchParams.get("asset"),
        url.searchParams.get("token"),
      );
    }
  } catch {
    /* not a URL */
  }
  return null;
}

/**
 * Accepts OpenPay Pro wallet receive QRs for every Pro token:
 * - Raw Pro wallet `0x…` (preferred receive QR payload)
 * - `https://…/pay/0x…?asset=OUSD|PI|BTC|…` (legacy / share links)
 * - `https://…/pay/0x…?token=<OpenToken uuid>&asset=SYM`
 * - Legacy `openpay:0x…?asset=…&token=…`
 * - `openpaypro:` / `ethereum:` schemes
 * - OpenPay `OP…` account, `@username`, email (Send flow)
 * - `https://openpy.space/pay/@user` pay links
 */
export function parsePaymentQr(text: string): ParsedPaymentQr {
  const raw = text
    .trim()
    .replace(/^\uFEFF/, "")
    .replace(/[\u0000-\u001F\u007F]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!raw) {
    return { to: "", rail: "wallet", kind: "unknown" };
  }

  // Bare 0x address (preferred receive QR)
  const compact = raw.replace(/\s/g, "");
  if (PRO_ADDR_RE.test(compact)) {
    return fromParts(compact);
  }

  // HTTP(S) OpenPay / Pro pay links (all token assets via ?asset= / ?token=)
  if (
    /^https?:\/\//i.test(raw) ||
    raw.includes("openpy.space") ||
    raw.includes("openpaypro.space") ||
    raw.includes("openpay") ||
    raw.includes("/pay/") ||
    raw.includes("/send")
  ) {
    const http = parseHttpPayUrl(raw.startsWith("http") ? raw : `https://${raw}`);
    if (http?.to) return http;
  }

  try {
    const lower = raw.toLowerCase();
    if (
      lower.startsWith("openpay:") ||
      lower.startsWith("openpaypro:") ||
      lower.startsWith("ethereum:") ||
      lower.startsWith("eip681:") ||
      lower.startsWith("solana:") ||
      (raw.includes("?") && raw.includes(":"))
    ) {
      const colon = raw.indexOf(":");
      const afterScheme = colon >= 0 ? raw.slice(colon + 1) : raw;
      const body = afterScheme.replace(/^\/\//, "");
      // solana:Address?amount=1  OR  solana:transfer?recipient=…
      if (lower.startsWith("solana:")) {
        const [pathPart, query] = body.split("?");
        const params = new URLSearchParams(query ?? "");
        const recipient =
          params.get("recipient") ||
          params.get("to") ||
          params.get("address") ||
          (pathPart && !/^transfer$/i.test(pathPart) ? pathPart : "");
        if (recipient) {
          return fromParts(
            recipient,
            params.get("amount") ?? params.get("value"),
            params.get("asset"),
            params.get("token"),
          );
        }
      }
      const [addrPart, query] = body.split("?");
      const params = new URLSearchParams(query ?? "");
      const addr = (addrPart ?? "").trim();
      return fromParts(
        addr,
        params.get("amount") ?? params.get("value"),
        params.get("asset"),
        params.get("token"),
      );
    }
  } catch {
    // fall through
  }

  // Bare address / OP / @user
  if (raw.includes("?")) {
    const [addr, query] = raw.split("?");
    const params = new URLSearchParams(query ?? "");
    return fromParts(
      addr,
      params.get("amount") ?? params.get("value"),
      params.get("asset"),
      params.get("token"),
    );
  }

  // Embedded 0x anywhere in noisy QR text
  const embedded = extractProAddress(raw);
  if (embedded) return fromParts(embedded);

  return fromParts(raw);
}

export function isProWalletAddress(to: string): boolean {
  return PRO_ADDR_RE.test(to.trim());
}

export function isOpenPayAccountId(to: string): boolean {
  const t = to.trim().replace(/^@+/, "");
  return OP_ACCOUNT_RE.test(t) || EMAIL_RE.test(t);
}
