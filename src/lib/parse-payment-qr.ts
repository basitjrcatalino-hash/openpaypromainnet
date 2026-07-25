export type ParsedPaymentQr = {
  to: string;
  amount?: string;
  asset?: "OUSD" | "PI";
};

/** Accepts: raw address | openpay:ADDR?asset=OUSD&amount=10 | ethereum:0x..?value=.. */
export function parsePaymentQr(text: string): ParsedPaymentQr {
  const raw = text.trim();
  try {
    if (raw.startsWith("openpay:") || raw.startsWith("ethereum:") || raw.includes("?")) {
      const colon = raw.indexOf(":");
      const afterScheme = colon >= 0 ? raw.slice(colon + 1) : raw;
      const body = afterScheme.replace(/^\/\//, "");
      const [addr, query] = body.split("?");
      const params = new URLSearchParams(query ?? "");
      const assetRaw = params.get("asset");
      const asset = assetRaw === "OUSD" || assetRaw === "PI" ? assetRaw : undefined;
      const amount = params.get("amount") ?? params.get("value") ?? undefined;
      return {
        to: (addr ?? "").trim(),
        amount: amount || undefined,
        asset,
      };
    }
  } catch {
    // fall through
  }
  return { to: raw };
}
