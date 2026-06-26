const BASE = import.meta.env.VITE_OPENPAY_QR_API_BASE as string;
const KEY = import.meta.env.VITE_OPENPAY_QR_API_KEY as string;

export type QrPayItem = { id?: string; name?: string; description?: string; quantity?: number; unit_price?: number; amount?: number };
export type QrPay = {
  token: string;
  title?: string;
  description?: string;
  amount: number;
  currency: string;
  image_url?: string;
};
export type QrPayResponse = { qr_pay: QrPay; items: QrPayItem[] };

async function req<T>(path: string, init: RequestInit = {}): Promise<T> {
  if (!BASE || !KEY) throw new Error("OpenPay API not configured");
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      "x-api-key": KEY,
      "content-type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  if (!res.ok) {
    let msg = `OpenPay ${res.status}`;
    try { const j = await res.json(); msg = j?.error || j?.message || msg; } catch {}
    throw new Error(msg);
  }
  return res.json() as Promise<T>;
}

export const openpayQr = {
  getQr: (token: string) => req<QrPayResponse>(`/qr/${encodeURIComponent(token)}`),
  listQr: () => req<{ qr_pays: QrPay[] }>(`/qr`),
  createCheckout: (body: {
    qr_pay_token: string;
    customer_email: string;
    customer_name?: string;
    success_url: string;
    cancel_url: string;
  }) => req<{ checkout_url: string }>(`/checkout-session`, { method: "POST", body: JSON.stringify(body) }),
  listTransactions: () => req<{ transactions: any[] }>(`/transactions`),
  getTransaction: (id: string) => req<{ transaction: any }>(`/transactions/${encodeURIComponent(id)}`),
};