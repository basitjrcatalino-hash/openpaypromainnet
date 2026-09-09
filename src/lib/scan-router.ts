import { parsePaymentQr, type ParsedPaymentQr } from "@/lib/parse-payment-qr";
import { extractPiWalletFromQr } from "@/lib/pi-payout";
import { isWalletConnectPayLink, normalizeWalletConnectPayLink } from "@/lib/walletconnect-pay";
import { looksLikeEmvQr, parseEmvQr, brandLabel, type EmvQr } from "@/lib/emv-qr";
import type { ScanTargetKey } from "@/lib/scan-targets";
import type { LedgerAssetCode } from "@/lib/ledger-majors";

export type ScanDecision =
  | {
      status: "route";
      target: ScanTargetKey;
      toast: string;
      /** Where to navigate — matches TanStack Router link options. */
      to: string;
      search: Record<string, string>;
    }
  | { status: "info"; target: ScanTargetKey; toast: string; emv?: EmvQr }
  | { status: "disabled"; target: ScanTargetKey; toast: string }
  | { status: "unknown"; toast: string };

const PRO_ADDR_RE = /^0x[a-fA-F0-9]{40}$/;

function proSearch(parsed: ParsedPaymentQr, rail: "wallet" | "openpay") {
  const search: Record<string, string> = { to: parsed.to, rail };
  if (parsed.amount) search["amount"] = parsed.amount;
  if (parsed.token) search["token"] = parsed.token;
  else search["asset"] = (parsed.asset ?? "OUSD") as LedgerAssetCode;
  return search;
}

/**
 * One camera, every OpenPay payload family.
 * Order matters: EMVCo first (never a URL), WalletConnect, then Pro before Pi,
 * then OpenPay accounts, so unknown codes get a single clear rejection.
 */
export function routeScannedQr(
  raw: string,
  enabled: Record<ScanTargetKey, boolean>,
  messages: Partial<Record<ScanTargetKey, string>> = {},
): ScanDecision {
  const text = String(raw || "").trim();
  if (!text) return { status: "unknown", toast: "QR decoded empty — try Photos or hold steadier" };

  const off = (target: ScanTargetKey, label: string): ScanDecision => ({
    status: "disabled",
    target,
    toast: messages[target] || `${label} scanning is turned off right now`,
  });

  // 1 — EMVCo / QR Ph bank & e-wallet QR
  if (looksLikeEmvQr(text)) {
    if (!enabled.qrph) return off("qrph", "QR Ph");
    const emv = parseEmvQr(text);
    const amount = emv.amount ? ` · ${emv.currency} ${emv.amount}` : "";
    return {
      status: "info",
      target: "qrph",
      toast: `${brandLabel(emv.brand)} QR — ${emv.merchantName}${amount}`,
      emv,
    };
  }

  // 2 — WalletConnect Pay links
  if (isWalletConnectPayLink(text)) {
    if (!enabled.walletconnect) return off("walletconnect", "WalletConnect Pay");
    return {
      status: "route",
      target: "walletconnect",
      toast: "WalletConnect Pay link scanned",
      to: "/wc-pay",
      search: { link: normalizeWalletConnectPayLink(text) },
    };
  }

  const parsed = parsePaymentQr(text);
  const isPro = parsed.kind === "pro_wallet" || PRO_ADDR_RE.test(parsed.to.trim());

  // 3 — OpenPay Pro wallet (0x…, /pay links, OpenToken QR)
  if (isPro) {
    if (!enabled.openpay_pro) return off("openpay_pro", "OpenPay Pro wallet");
    const label = parsed.token
      ? "OpenPay Pro token QR scanned"
      : parsed.asset
        ? `OpenPay Pro ${parsed.asset} QR scanned`
        : "OpenPay Pro wallet scanned";
    return {
      status: "route",
      target: "openpay_pro",
      toast: label,
      to: "/send",
      search: proSearch(parsed, "wallet"),
    };
  }

  // 4 — Pi Wallet (G… address, pi:/stellar: URI, JSON)
  const piAddress = extractPiWalletFromQr(text);
  if (piAddress) {
    if (!enabled.pi_wallet) return off("pi_wallet", "Pi Wallet");
    const search: Record<string, string> = { to: piAddress };
    if (parsed.amount) search["amount"] = parsed.amount;
    return {
      status: "route",
      target: "pi_wallet",
      toast: "Pi Wallet address scanned",
      to: "/send/pi",
      search,
    };
  }

  // 5 — OpenPay account (OP…, @username, email, openpay:// links)
  if (parsed.kind === "openpay_account" && parsed.to) {
    if (!enabled.openpay) return off("openpay", "OpenPay account");
    return {
      status: "route",
      target: "openpay",
      toast: `OpenPay account scanned — @${parsed.to.replace(/^@+/, "")}`,
      to: "/send",
      search: proSearch(parsed, "openpay"),
    };
  }

  const preview = text.slice(0, 48);
  return {
    status: "unknown",
    toast: `Not an OpenPay QR code${preview ? ` (${preview}${text.length > 48 ? "…" : ""})` : ""}`,
  };
}
