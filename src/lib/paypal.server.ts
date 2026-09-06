/**
 * PayPal server helpers — Orders v2, intent CAPTURE, 1 OUSD = 1 USD.
 * Docs: https://developer.paypal.com/docs/api/orders/v2/
 */

function env(): "live" | "sandbox" {
  return (process.env["PAYPAL_ENV"] || "live").toLowerCase() === "sandbox" ? "sandbox" : "live";
}

function apiBase(): string {
  return env() === "sandbox"
    ? "https://api-m.sandbox.paypal.com"
    : "https://api-m.paypal.com";
}

export function getPaypalClientId(): string {
  return process.env["PAYPAL_CLIENT_ID"] || "";
}

function getPaypalSecret(): string {
  return process.env["PAYPAL_SECRET"] || process.env["PAYPAL_CLIENT_SECRET"] || "";
}

export function isPaypalConfigured(): boolean {
  return Boolean(getPaypalClientId() && getPaypalSecret());
}

export function getPaypalEnv() {
  return env();
}

async function accessToken(): Promise<string> {
  const id = getPaypalClientId();
  const secret = getPaypalSecret();
  if (!id || !secret) throw new Error("PayPal is not configured");
  const res = await fetch(`${apiBase()}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${btoa(`${id}:${secret}`)}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  const json = (await res.json().catch(() => ({}))) as {
    access_token?: string;
    error_description?: string;
  };
  if (!res.ok || !json.access_token) {
    throw new Error(json.error_description || `PayPal auth failed (${res.status})`);
  }
  return json.access_token;
}

async function ppFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const token = await accessToken();
  const res = await fetch(`${apiBase()}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  const text = await res.text();
  const json = (text ? JSON.parse(text) : {}) as Record<string, unknown>;
  if (!res.ok) {
    const details = (json["details"] as { description?: string }[] | undefined)?.[0]?.description;
    throw new Error(
      details || (json["message"] as string) || `PayPal request failed (${res.status})`,
    );
  }
  return json as T;
}

export async function createPaypalOrderServer(opts: {
  amountUsd: number;
  userId: string;
  orderRef: string;
}): Promise<{ orderId: string; status: string }> {
  const value = (Math.round(opts.amountUsd * 100) / 100).toFixed(2);
  const order = await ppFetch<{ id: string; status: string }>("/v2/checkout/orders", {
    method: "POST",
    headers: { "PayPal-Request-Id": opts.orderRef },
    body: JSON.stringify({
      intent: "CAPTURE",
      purchase_units: [
        {
          reference_id: opts.orderRef,
          custom_id: opts.userId,
          description: `OpenPay Pro top-up · ${value} OUSD`,
          amount: { currency_code: "USD", value },
        },
      ],
      application_context: {
        shipping_preference: "NO_SHIPPING",
        user_action: "PAY_NOW",
        brand_name: "OpenPay Pro",
      },
    }),
  });
  return { orderId: order.id, status: order.status };
}

type PaypalOrder = {
  id: string;
  status: string;
  purchase_units?: {
    custom_id?: string;
    amount?: { value?: string };
    payments?: { captures?: { id: string; status: string; amount?: { value?: string } }[] };
  }[];
};

export type PaypalCaptureResult = {
  status: string;
  paid: boolean;
  amountUsd: number;
  userId: string | null;
  captureId: string | null;
};

function summarise(order: PaypalOrder): PaypalCaptureResult {
  const unit = order.purchase_units?.[0];
  const capture = unit?.payments?.captures?.[0];
  const amount = Number(capture?.amount?.value ?? unit?.amount?.value ?? 0);
  return {
    status: order.status,
    paid: order.status === "COMPLETED" && (capture?.status ?? "COMPLETED") === "COMPLETED",
    amountUsd: Number.isFinite(amount) ? amount : 0,
    userId: unit?.custom_id ?? null,
    captureId: capture?.id ?? null,
  };
}

/** Capture an approved order (or read it back when already captured). */
export async function capturePaypalOrderServer(orderId: string): Promise<PaypalCaptureResult> {
  const order = await ppFetch<PaypalOrder>(`/v2/checkout/orders/${orderId}`);
  if (order.status === "COMPLETED") return summarise(order);
  if (order.status !== "APPROVED") {
    return { ...summarise(order), paid: false };
  }
  const captured = await ppFetch<PaypalOrder>(`/v2/checkout/orders/${orderId}/capture`, {
    method: "POST",
    body: JSON.stringify({}),
  });
  return summarise(captured);
}
