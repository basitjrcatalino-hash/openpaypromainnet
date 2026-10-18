import QRCode from "qrcode";

const SITE = "https://openpaypro.space";

function appOrigin(): string {
  if (typeof window !== "undefined" && window.location?.origin) {
    const o = window.location.origin.replace(/\/$/, "");
    // Prefer production host in pay links so phone cameras open a real public URL.
    if (/localhost|127\.0\.0\.1|0\.0\.0\.0/i.test(o)) return SITE;
    return o;
  }
  const env =
    typeof import.meta !== "undefined"
      ? (import.meta.env?.VITE_APP_URL as string | undefined)?.replace(/\/$/, "")
      : undefined;
  return env || SITE;
}

export type ReceiveQrOptions = {
  address: string;
  asset?: string;
  amount?: string;
  /** OpenToken uuid when receiving a specific token. */
  token?: string;
};

/**
 * Payload encoded in the on-screen receive QR.
 * Uses the bare wallet address (or openpay:… with amount/token) so scanners
 * read the address — not an HTTPS link that only opens the app.
 */
export function buildReceiveQrPayload(opts: ReceiveQrOptions): string {
  const address = opts.address.trim();
  if (!address) return "";
  const amount = opts.amount?.trim();
  const needsMeta = !!(amount || opts.token);
  if (!needsMeta) return address;
  return buildOpenPaySchemeUri(opts);
}

/**
 * HTTPS receive link for Share / “Copy receive link”.
 * Phone cameras open this; OpenPay Scan / /pay/$to still parse the address.
 */
export function buildReceivePayUri(opts: ReceiveQrOptions): string {
  const address = opts.address.trim();
  if (!address) return "";
  const params = new URLSearchParams();
  if (opts.asset) params.set("asset", opts.asset);
  if (opts.amount?.trim()) params.set("amount", opts.amount.trim());
  if (opts.token) params.set("token", opts.token);
  const qs = params.toString();
  return `${appOrigin()}/pay/${encodeURIComponent(address)}${qs ? `?${qs}` : ""}`;
}

/** Custom-scheme URI (accepted by parsePaymentQr; used when amount/token is set). */
export function buildOpenPaySchemeUri(opts: ReceiveQrOptions): string {
  const address = opts.address.trim();
  if (!address) return "";
  const params = new URLSearchParams();
  if (opts.asset) params.set("asset", opts.asset);
  if (opts.amount?.trim()) params.set("amount", opts.amount.trim());
  if (opts.token) params.set("token", opts.token);
  const qs = params.toString();
  return `openpay:${address}${qs ? `?${qs}` : ""}`;
}

/** High-contrast QR tuned for phone→phone / screen scanning. */
export async function walletQrDataUrl(payload: string, size = 280): Promise<string> {
  return QRCode.toDataURL(payload, {
    width: size,
    margin: 4,
    color: { dark: "#000000", light: "#ffffff" },
    errorCorrectionLevel: "M",
  });
}
