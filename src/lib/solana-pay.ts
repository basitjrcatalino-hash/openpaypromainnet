/**
 * Solana Pay helpers (@solana-commerce/solana-pay).
 * Docs: https://solana.com/docs/tools/commerce-kit/quickstart/solana-pay
 */
import {
  SOLANA_MERCHANT_NAME,
  resolveSolanaMerchantWallet,
} from "@/lib/solana-payment";

export type SolanaPayTransferOpts = {
  /** Recipient; falls back to VITE_SOLANA_MERCHANT_WALLET */
  recipient?: string | null;
  /** Human amount in SOL (not lamports). Omit for open tip request. */
  amountSol?: number;
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

/**
 * Build a `solana:` transfer request URL (client-only; dynamic import for SSR safety).
 */
export async function buildSolanaPayUrl(opts: SolanaPayTransferOpts = {}): Promise<URL> {
  const recipientRaw = resolveSolanaMerchantWallet(opts.recipient);
  if (!recipientRaw) throw new Error("Solana merchant wallet is not configured");

  const { createRecipient, encodeURL, isValidSolanaAddress } = await import(
    "@solana-commerce/solana-pay"
  );

  if (!isValidSolanaAddress(recipientRaw)) {
    throw new Error("Invalid Solana merchant address");
  }

  return encodeURL({
    recipient: createRecipient(recipientRaw),
    amount:
      opts.amountSol != null && opts.amountSol > 0
        ? solToLamports(opts.amountSol)
        : undefined,
    label: opts.label ?? SOLANA_MERCHANT_NAME,
    message: opts.message ?? "Pay OpenPay Pro with Solana Pay",
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
