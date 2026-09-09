/**
 * Minimal EMVCo / QR Ph (InstaPay) payload parser.
 * Lets the OpenPay Pro scanner recognise bank & e-wallet QR codes
 * (GCash, Maya, GrabPay, ShopeePay, InstaPay bank QR) alongside OpenPay QRs.
 */

export type EmvBrand = "gcash" | "maya" | "grabpay" | "shopeepay" | "instapay" | "qrph" | "bank";

export type EmvQr = {
  raw: string;
  merchantName: string;
  merchantCity: string;
  amount: number | null;
  currency: string;
  accountNumber: string;
  brand: EmvBrand;
  guids: string[];
  bicHint: string;
};

/** EMVCo payloads always start with the payload format indicator "0002xx". */
export function looksLikeEmvQr(value: string): boolean {
  const v = String(value || "").trim();
  return /^0002\d{2}/.test(v) && v.length >= 30 && !v.includes("://");
}

type Tlv = Record<string, string>;

function parseTlv(payload: string): Tlv {
  const out: Tlv = {};
  let i = 0;
  while (i + 4 <= payload.length) {
    const tag = payload.slice(i, i + 2);
    const len = Number(payload.slice(i + 2, i + 4));
    if (!/^\d{2}$/.test(tag) || !Number.isFinite(len)) break;
    const value = payload.slice(i + 4, i + 4 + len);
    if (value.length < len) break;
    out[tag] = value;
    i += 4 + len;
  }
  return out;
}

const looksLikeBic = (v: string) => /^[A-Z]{4}PH[A-Z0-9]{2}([A-Z0-9]{3})?$/i.test(v.trim());
const looksLikeAccount = (v: string) => /^[0-9+]{6,}$/.test(v.replace(/\s+/g, ""));

function detectBrand(raw: string, merchantName: string, guids: string[]): EmvBrand {
  const hay = `${raw} ${merchantName} ${guids.join(" ")}`.toLowerCase();
  if (/gcash|gxch|g-xchange|mynt/.test(hay)) return "gcash";
  if (/maya|paymaya|paph/.test(hay)) return "maya";
  if (/grab/.test(hay)) return "grabpay";
  if (/shopee/.test(hay)) return "shopeepay";
  if (/instapay/.test(hay)) return "instapay";
  if (/ppmi|qrph|qr ph/.test(hay)) return "qrph";
  return "bank";
}

export function brandLabel(brand: EmvBrand): string {
  return brand === "gcash"
    ? "GCash"
    : brand === "maya"
      ? "Maya"
      : brand === "grabpay"
        ? "GrabPay"
        : brand === "shopeepay"
          ? "ShopeePay"
          : brand === "instapay"
            ? "InstaPay"
            : brand === "qrph"
              ? "QR Ph"
              : "Bank";
}

export function parseEmvQr(raw: string): EmvQr {
  const payload = String(raw || "").trim();
  const tlv = parseTlv(payload);

  const guids: string[] = [];
  const accountCandidates: string[] = [];
  let bicHint = "";

  for (let tag = 26; tag <= 51; tag++) {
    const key = String(tag).padStart(2, "0");
    const template = tlv[key];
    if (!template) continue;
    const inner = parseTlv(template);
    const guid = (inner["00"] || "").trim();
    if (guid) guids.push(guid);

    for (const k of ["05", "04", "03", "02", "01"] as const) {
      const candidate = String(inner[k] || "").trim();
      if (!candidate) continue;
      if (!bicHint && looksLikeBic(candidate)) {
        bicHint = candidate.toUpperCase();
        continue;
      }
      if (looksLikeAccount(candidate)) accountCandidates.push(candidate.replace(/\s+/g, ""));
    }
  }

  if (!bicHint) {
    const m = payload.match(/[A-Z]{4}PH[A-Z0-9]{2}([A-Z0-9]{3})?/i);
    if (m) bicHint = m[0].toUpperCase();
  }

  const amountRaw = Number(tlv["54"]);
  const merchantName = (tlv["59"] || "").trim();

  return {
    raw: payload,
    merchantName: merchantName || "QR Ph merchant",
    merchantCity: (tlv["60"] || "").trim(),
    amount: Number.isFinite(amountRaw) && amountRaw > 0 ? amountRaw : null,
    currency: tlv["53"] === "608" ? "PHP" : tlv["53"] || "PHP",
    accountNumber: accountCandidates[0] || "",
    brand: detectBrand(payload, merchantName, guids),
    guids,
    bicHint,
  };
}
