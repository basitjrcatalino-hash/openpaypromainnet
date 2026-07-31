/**
 * Solana Pay helpers (@solana-commerce/solana-pay).
 * Docs: https://solana.com/docs/tools/commerce-kit/quickstart/solana-pay
 * SPL tokens: https://solana.com/docs/tokens · CASH: https://docs.phantom.com/cash
 */
import {
  SOLANA_MERCHANT_NAME,
  resolveSolanaMerchantWallet,
} from "@/lib/solana-payment";
import { MAJOR_TOKENS } from "@/lib/major-tokens";

/** Phantom CASH SPL mint (6 decimals). */
export const CASH_MINT = MAJOR_TOKENS.cash.mintAddress!;
export const CASH_DECIMALS = 6;

export type SolanaPayTransferOpts = {
  /** Recipient; falls back to VITE_SOLANA_MERCHANT_WALLET */
  recipient?: string | null;
  /** Human amount in SOL (not lamports). Omit for open tip request. */
  amountSol?: number;
  /**
   * SPL mint for token transfer requests (omit for native SOL).
   * Amount uses `amountToken` (UI units) → base units via `tokenDecimals`.
   */
  splToken?: string | null;
  /** Human token amount (UI units). Required when `splToken` is set with a fixed amount. */
  amountToken?: number;
  /** Decimals for `splToken` base-unit conversion (default 6 for USDC/CASH). */
  tokenDecimals?: number;
  label?: string;
  message?: string;
  memo?: string;
};

/** Lamports for a SOL amount (9 decimals). */
export function solToLamports(amountSol: number): bigint {
  if (!Number.isFinite(amountSol) || amountSol < 0) {
    throw new Error("Invalid SOL amount");
  }
  return BigInt(Math.round(amountSol * 1e9));
}

/** Base units for an SPL token UI amount. */
export function tokenToBaseUnits(amount: number, decimals: number): bigint {
  if (!Number.isFinite(amount) || amount < 0) {
    throw new Error("Invalid token amount");
  }
  if (!Number.isInteger(decimals) || decimals < 0 || decimals > 18) {
    throw new Error("Invalid token decimals");
  }
  const scale = 10 ** decimals;
  return BigInt(Math.round(amount * scale));
}

/**
 * Build a `solana:` transfer request URL (client-only; dynamic import for SSR safety).
 * Native SOL when `splToken` is omitted; SPL (e.g. CASH) when mint is set.
 */
export async function buildSolanaPayUrl(opts: SolanaPayTransferOpts = {}): Promise<URL> {
  const recipientRaw = resolveSolanaMerchantWallet(opts.recipient);
  if (!recipientRaw) throw new Error("Solana merchant wallet is not configured");

  const { createRecipient, createSPLToken, encodeURL, isValidSolanaAddress } = await import(
    "@solana-commerce/solana-pay"
  );

  if (!isValidSolanaAddress(recipientRaw)) {
    throw new Error("Invalid Solana merchant address");
  }

  const spl = opts.splToken?.trim() || undefined;
  if (spl && !isValidSolanaAddress(spl)) {
    throw new Error("Invalid SPL token mint");
  }

  let amount: bigint | undefined;
  if (spl) {
    const decimals = opts.tokenDecimals ?? CASH_DECIMALS;
    if (opts.amountToken != null && opts.amountToken > 0) {
      amount = tokenToBaseUnits(opts.amountToken, decimals);
    }
  } else if (opts.amountSol != null && opts.amountSol > 0) {
    amount = solToLamports(opts.amountSol);
  }

  return encodeURL({
    recipient: createRecipient(recipientRaw),
    amount,
    ...(spl ? { splToken: createSPLToken(spl) } : {}),
    label: opts.label ?? SOLANA_MERCHANT_NAME,
    message:
      opts.message ??
      (spl
        ? `Pay OpenPay Pro with ${spl === CASH_MINT ? "CASH" : "SPL"}`
        : "Pay OpenPay Pro with Solana Pay"),
    memo: opts.memo,
  });
}

/** SVG markup for a Solana Pay QR (client-only). */
export async function buildSolanaPayQrSvg(
  opts: SolanaPayTransferOpts & { size?: number } = {},
): Promise<{ url: string; svg: string }> {
  const url = await buildSolanaPayUrl(opts);
  const { createQR } = await import("@solana-commerce/solana-pay");
  const svg = await createQR(url.toString(), opts.size ?? 400, "white", "#0f172a");
  return { url: url.toString(), svg };
}

/** Convenience: Solana Pay transfer request for Phantom CASH → merchant. */
export async function buildCashPayQrSvg(opts: {
  recipient?: string | null;
  amountCash: number;
  memo?: string;
  size?: number;
}): Promise<{ url: string; svg: string }> {
  return buildSolanaPayQrSvg({
    recipient: opts.recipient,
    splToken: CASH_MINT,
    amountToken: opts.amountCash,
    tokenDecimals: CASH_DECIMALS,
    label: SOLANA_MERCHANT_NAME,
    message: "OpenPay Pro · Pay with CASH",
    memo: opts.memo ?? "cash_pay",
    size: opts.size ?? 360,
  });
}
