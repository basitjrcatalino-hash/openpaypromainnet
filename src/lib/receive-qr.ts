import QRCode from "qrcode";

const SITE = "https://openpaypro.space";

function appOrigin(): string {
  if (typeof window !== "undefined" && window.location?.origin) {
    const o = window.location.origin.replace(/\/$/, "");
    // Prefer production host in QR so phone cameras open a real public URL.
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
 * HTTPS receive URI — phone cameras open this instead of showing "No data"
 * for the custom `openpay:` scheme. OpenPay Scan / Send still parse it.
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

/** Legacy custom-scheme URI (still accepted by parsePaymentQr). */
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
    margin: 3,
    color: { dark: "#111111", light: "#ffffff" },
    errorCorrectionLevel: "H",
  });
}
