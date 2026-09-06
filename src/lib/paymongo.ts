/** PayMongo QR Ph provider tiles (branding only — every tile pays via one QR Ph code). */
export type QrPhProvider = { id: string; label: string; hint: string };

export const QRPH_PROVIDERS: readonly QrPhProvider[] = [
  { id: "", label: "QR Ph", hint: "Scan with GCash, Maya, or any QR Ph bank app" },
  { id: "gcash", label: "GCash", hint: "Scan with GCash" },
  { id: "maya", label: "Maya", hint: "Scan with Maya" },
  { id: "grab_pay", label: "GrabPay", hint: "Scan with Grab" },
  { id: "shopee_pay", label: "ShopeePay", hint: "Scan with Shopee" },
  { id: "bdo", label: "BDO", hint: "Scan with BDO Pay" },
  { id: "landbank", label: "Land Bank", hint: "Scan with Landbank Mobile" },
  { id: "metrobank", label: "Metrobank", hint: "Scan with Metrobank Online" },
  { id: "rcbc", label: "RCBC", hint: "Scan with RCBC Pulz" },
  { id: "chinabank", label: "Chinabank", hint: "Scan with Chinabank" },
] as const;

export const PAYMONGO_MIN_USD = 1;
export const PAYMONGO_MAX_USD = 10_000;
