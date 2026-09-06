/**
 * PayMongo server helpers — QR Ph cash-in (GCash, Maya, GrabPay, banks…).
 * All tiles use PayMongo `qrph`; the chosen brand is metadata only.
 * Docs: https://docs.paymongo.com/docs/payment-acceptance-qr-ph-api
 */

const API = "https://api.paymongo.com/v1";

export function getPaymongoSecretKey(): string {
  return (
    process.env["PAYMONGO_SECRET_KEY"] ||
    // The PayMongo secret key was stored under this name by the project owner.
    process.env["STRIPE_LIVE_API_KEY"] ||
    ""
  );
}

export function getPhpPerUsd(): number {
  const n = Number(process.env["PAYMONGO_PHP_PER_USD"] || 62.72);
  return Number.isFinite(n) && n > 0 ? n : 62.72;
}

export function isPaymongoConfigured(): boolean {
  return getPaymongoSecretKey().startsWith("sk_");
}

async function pmFetch(path: string, init?: RequestInit) {
  const key = getPaymongoSecretKey();
  if (!key) throw new Error("PayMongo is not configured");
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Basic ${btoa(`${key}:`)}`,
      ...(init?.headers ?? {}),
    },
  });
  const json = (await res.json().catch(() => ({}))) as {
    data?: { id: string; attributes: Record<string, unknown> };
    errors?: { detail?: string }[];
  };
  if (!res.ok || json.errors?.length) {
    throw new Error(json.errors?.[0]?.detail || `PayMongo request failed (${res.status})`);
  }
  if (!json.data) throw new Error("PayMongo returned an empty response");
  return json.data;
}

export type PaymongoQrIntent = {
  intentId: string;
  clientKey: string;
  status: string;
  amountUsd: number;
  phpAmount: number;
  phpRate: number;
  qrImageUrl: string | null;
};

export async function createQrPhIntent(opts: {
  amountUsd: number;
  userId: string;
  orderRef: string;
  preferredProvider?: string;
  preferredProviderName?: string;
}): Promise<PaymongoQrIntent> {
  const phpRate = getPhpPerUsd();
  const phpAmount = Math.round(opts.amountUsd * phpRate * 100) / 100;
  const centavos = Math.round(phpAmount * 100);

  const intent = await pmFetch("/payment_intents", {
    method: "POST",
    body: JSON.stringify({
      data: {
        attributes: {
          amount: centavos,
          currency: "PHP",
          payment_method_allowed: ["qrph"],
          capture_type: "automatic",
          description: `OpenPay Pro top-up · ${opts.amountUsd} OUSD`,
          metadata: {
            purpose: "ousd_topup",
            user_id: opts.userId,
            method: "qr_ph",
            usd_amount: String(opts.amountUsd),
            php_amount: String(phpAmount),
            php_rate: String(phpRate),
            order_ref: opts.orderRef,
            ...(opts.preferredProvider ? { preferred_provider: opts.preferredProvider } : {}),
            ...(opts.preferredProviderName
              ? { preferred_provider_name: opts.preferredProviderName }
              : {}),
          },
        },
      },
    }),
  });

  const method = await pmFetch("/payment_methods", {
    method: "POST",
    body: JSON.stringify({ data: { attributes: { type: "qrph" } } }),
  });

  const clientKey = String(intent.attributes["client_key"] ?? "");
  const attached = await pmFetch(`/payment_intents/${intent.id}/attach`, {
    method: "POST",
    body: JSON.stringify({
      data: { attributes: { payment_method: method.id, client_key: clientKey } },
    }),
  });

  const nextAction = attached.attributes["next_action"] as
    | { code?: { image_url?: string } }
    | undefined;

  return {
    intentId: attached.id,
    clientKey,
    status: String(attached.attributes["status"] ?? ""),
    amountUsd: opts.amountUsd,
    phpAmount,
    phpRate,
    qrImageUrl: nextAction?.code?.image_url ?? null,
  };
}

export type PaymongoIntentStatus = {
  status: string;
  paid: boolean;
  amountUsd: number;
  userId: string | null;
};

export async function getIntentStatus(intentId: string): Promise<PaymongoIntentStatus> {
  const intent = await pmFetch(`/payment_intents/${intentId}`);
  const status = String(intent.attributes["status"] ?? "");
  const metadata = (intent.attributes["metadata"] ?? {}) as Record<string, string>;
  return {
    status,
    paid: status === "succeeded",
    amountUsd: Number(metadata["usd_amount"] ?? 0),
    userId: metadata["user_id"] ?? null,
  };
}
