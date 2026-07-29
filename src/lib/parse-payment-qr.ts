export type ParsedPaymentQr = {
  to: string;
  amount?: string;
  asset?: "OUSD" | "PI" | "BTC" | "ETH" | "SOL";
  /** Which send rail this QR should use. */
  rail: "wallet" | "openpay";
  kind: "pro_wallet" | "openpay_account" | "unknown";
};

const PRO_ADDR_RE = /^0x[a-fA-F0-9]{40}$/;
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

function parseAsset(raw: string | null): "OUSD" | "PI" | "BTC" | "ETH" | "SOL" | undefined {
  if (raw === "OUSD" || raw === "PI" || raw === "BTC" || raw === "ETH" || raw === "SOL") return raw;
  return undefined;
}

function fromParts(toRaw: string, amount?: string | null, assetRaw?: string | null): ParsedPaymentQr {
  const to = toRaw.trim().replace(/^@+/, "").replace(/^\/+/, "");
  const amountClean = amount?.trim() || undefined;
  const asset = parseAsset(assetRaw ?? null);
  const cls = classifyRecipient(to);
  // Keep @ for display on openpay usernames that were explicitly @-prefixed in URL path
  return {
    to,
    amount: amountClean,
    asset,
    ...cls,
  };
}

/** Extract payee from OpenPay / OpenPay Pro web pay links. */
function parseHttpPayUrl(raw: string): ParsedPaymentQr | null {
  try {
    const url = new URL(raw);
    const host = url.hostname.replace(/^www\./, "").toLowerCase();
    const isOpenPayHost =
      host === "openpy.space" ||
      host === "openpay.space" ||
      host.endsWith(".openpy.space") ||
      host.endsWith(".openpay.space") ||
      host.includes("openpay") ||
      host.includes("openpy");

    if (!isOpenPayHost && !raw.includes("/pay/")) return null;

    // https://openpy.space/pay/@alice?amount=10
    // https://openpy.space/pay/alice
    const payMatch = url.pathname.match(/\/pay\/([^/?#]+)/i);
    if (payMatch?.[1]) {
      const handle = decodeURIComponent(payMatch[1]).replace(/^@+/, "");
      return fromParts(
        handle,
        url.searchParams.get("amount") ?? url.searchParams.get("value"),
        url.searchParams.get("asset") ?? "OUSD",
      );
    }

    // Query-style: ?to=0x… | ?address= | ?account=OP… | ?username=
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
      );
    }
  } catch {
    /* not a URL */
  }
  return null;
}

/**
 * Accepts:
 * - Raw Pro wallet `0x…`
 * - Solana base58 addresses / `solana:…` URIs
 * - `openpay:0x…?asset=OUSD&amount=10` (OpenPay Pro receive QR)
 * - `openpaypro:0x…` / `ethereum:0x…`
 * - OpenPay `OP…` account, `@username`, email
 * - `https://openpy.space/pay/@user` / pay links
 */
export function parsePaymentQr(text: string): ParsedPaymentQr {
  const raw = text.trim();
  if (!raw) {
    return { to: "", rail: "wallet", kind: "unknown" };
  }

  // HTTP(S) OpenPay / Pro pay links
  if (/^https?:\/\//i.test(raw) || raw.includes("openpy.space") || raw.includes("/pay/")) {
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
    );
  }

  return fromParts(raw);
}

export function isProWalletAddress(to: string): boolean {
  return PRO_ADDR_RE.test(to.trim());
}

export function isOpenPayAccountId(to: string): boolean {
  const t = to.trim().replace(/^@+/, "");
  return OP_ACCOUNT_RE.test(t) || EMAIL_RE.test(t);
}
