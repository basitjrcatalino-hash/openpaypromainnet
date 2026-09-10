# PayPal + Debit/Credit Card Top-Up (Visa · Mastercard) — Integration Guide

How OpenPay Pro credits **1 OUSD = 1 USD** from a PayPal or guest **card** payment
(Visa, Mastercard, Amex, Discover) using **PayPal Orders v2** with `intent=CAPTURE`.

Copy this into OpenPay to get the exact same top-up flow.

---

## 1. Flow

```
Buyer picks amount  →  server POST /v2/checkout/orders        → order.id
Buyer approves      →  PayPal JS SDK Buttons (paypal | card)  → onApprove(orderID)
Server captures     →  POST /v2/checkout/orders/{id}/capture  → COMPLETED
Server credits      →  wallet + ledger tx (tx_hash = paypal:{orderId})  ← idempotent
```

No webhook is required: capture is server-side and idempotent on `tx_hash`.

---

## 2. Environment

```bash
PAYPAL_ENV="live"              # or "sandbox"
PAYPAL_CLIENT_ID="A..."        # safe to expose to the browser
PAYPAL_SECRET="E..."           # SERVER ONLY (PAYPAL_CLIENT_SECRET also accepted)
```

| Env | API base |
| --- | --- |
| live | `https://api-m.paypal.com` |
| sandbox | `https://api-m.sandbox.paypal.com` |

Limits used in the app:

```ts
export const PAYPAL_MIN_USD = 1;
export const PAYPAL_MAX_USD = 10_000;

export type PaypalFundingMethod = "paypal" | "card";

export const PAYPAL_FUNDING = [
  { id: "paypal", label: "PayPal", source: "paypal", hint: "Pay with your PayPal balance, bank or card" },
  { id: "card",   label: "Debit / credit card", source: "card", hint: "Guest checkout with a card" },
] as const;
```

Venmo / Pay Later are intentionally **not** enabled.

---

## 3. Server helpers (`paypal.server.ts`)

```ts
function apiBase() {
  return (process.env.PAYPAL_ENV || "live").toLowerCase() === "sandbox"
    ? "https://api-m.sandbox.paypal.com"
    : "https://api-m.paypal.com";
}

async function accessToken(): Promise<string> {
  const id = process.env.PAYPAL_CLIENT_ID!;
  const secret = process.env.PAYPAL_SECRET || process.env.PAYPAL_CLIENT_SECRET!;
  const res = await fetch(`${apiBase()}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${btoa(`${id}:${secret}`)}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  const json = await res.json();
  if (!res.ok || !json.access_token) throw new Error(json.error_description || "PayPal auth failed");
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
  const json = text ? JSON.parse(text) : {};
  if (!res.ok) {
    throw new Error(json?.details?.[0]?.description || json?.message || `PayPal ${res.status}`);
  }
  return json as T;
}
```

### Create order

```ts
export async function createPaypalOrderServer({ amountUsd, userId, orderRef }) {
  const value = (Math.round(amountUsd * 100) / 100).toFixed(2);
  return ppFetch<{ id: string; status: string }>("/v2/checkout/orders", {
    method: "POST",
    headers: { "PayPal-Request-Id": orderRef },   // idempotency
    body: JSON.stringify({
      intent: "CAPTURE",
      purchase_units: [{
        reference_id: orderRef,
        custom_id: userId,                        // ties payment to the account
        description: `OpenPay top-up · ${value} OUSD`,
        amount: { currency_code: "USD", value },
      }],
      application_context: {
        shipping_preference: "NO_SHIPPING",
        user_action: "PAY_NOW",
        brand_name: "OpenPay",
      },
    }),
  });
}
```

### Capture order (read-then-capture, safe to retry)

```ts
export async function capturePaypalOrderServer(orderId: string) {
  const order = await ppFetch<PaypalOrder>(`/v2/checkout/orders/${orderId}`);
  if (order.status === "COMPLETED") return summarise(order);
  if (order.status !== "APPROVED") return { ...summarise(order), paid: false };
  const captured = await ppFetch<PaypalOrder>(`/v2/checkout/orders/${orderId}/capture`, {
    method: "POST",
    body: JSON.stringify({}),
  });
  return summarise(captured);
}

function summarise(order) {
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
```

### Raw HTTP equivalents

```bash
# token
curl -u "$PAYPAL_CLIENT_ID:$PAYPAL_SECRET" \
  -d grant_type=client_credentials \
  https://api-m.paypal.com/v1/oauth2/token

# create
curl -X POST https://api-m.paypal.com/v2/checkout/orders \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -H "PayPal-Request-Id: OPP-XYZ123" \
  -d '{"intent":"CAPTURE","purchase_units":[{"reference_id":"OPP-XYZ123","custom_id":"<user-uuid>","amount":{"currency_code":"USD","value":"25.00"}}]}'

# capture
curl -X POST https://api-m.paypal.com/v2/checkout/orders/$ORDER_ID/capture \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{}'
```

---

## 4. Authenticated endpoints (server functions)

| Function | Method | Input | Output |
| --- | --- | --- | --- |
| `getPaypalConfig` | GET | – | `{ configured, clientId, env, currency }` |
| `createPaypalTopupOrder` | POST | `{ amountUsd }` (1–10 000) | `{ orderId, status, orderRef }` |
| `capturePaypalTopup` | POST | `{ orderId, method?, walletId? }` | `{ paid, status, alreadyCredited, amount, balance }` |

Crediting rules inside `capturePaypalTopup`:

1. Reject if `purchase_units[0].custom_id !== auth user id` → *“Payment belongs to another user”*.
2. Return `{ paid:false }` unless the order is `COMPLETED`.
3. Idempotency: look up `transactions.tx_hash = "paypal:{orderId}"`; if found return `alreadyCredited:true`.
4. Resolve target wallet (`walletId` owned by user, else active wallet).
5. Credit via `creditTopupWithFee({ grossAmount, counterparty: "paypal:{id}", txHash, memo })`.
6. Unique-violation on insert is treated as already credited.

---

## 5. Client (PayPal JS SDK)

```ts
const params = new URLSearchParams({
  "client-id": clientId,
  currency: "USD",
  intent: "capture",
  components: "buttons,messages",
  "enable-funding": "card",          // Visa / Mastercard guest checkout
});
script.src = `https://www.paypal.com/sdk/js?${params}`;
```

Render one funding source at a time (`paypal` **or** `card`):

```ts
const fundingSource = sdk.FUNDING[funding.toUpperCase()];   // PAYPAL | CARD
const buttons = sdk.Buttons({
  fundingSource,
  style: { layout: "vertical", shape: "pill", height: 48, label: "pay" },
  createOrder: async () => (await createPaypalTopupOrder({ data: { amountUsd } })).orderId,
  onApprove: async (data) => {
    const res = await capturePaypalTopup({
      data: { orderId: data.orderID, method: funding, walletId },
    });
    if (res.paid) toast.success("Payment received — OUSD credited");
    else toast.error("PayPal has not confirmed this payment yet");
  },
  onCancel: () => toast.message("PayPal checkout cancelled"),
  onError: (err) => setError(err?.message ?? "PayPal checkout failed"),
});

if (buttons.isEligible && !buttons.isEligible()) {
  setError("This PayPal method isn’t available on your device or region.");
} else {
  await buttons.render(container);
}
```

Re-mount the buttons whenever `funding` or `clientId` changes; clear
`container.innerHTML` first. The SDK script is loaded once and cached in a
module-level promise.

### UI structure used in OpenPay Pro

1. **You pay** card — `$25.00`, subtitle `1 OUSD = $1.00 · credited automatically after approval`.
2. Two-column funding selector: **PayPal** / **Debit / credit card**, with the hint text below.
3. Centered button host (`max-w-md`, centered on desktop, full width on mobile), spinner while loading, error line in destructive colour.
4. On success: green check, “Payment received”, `{amount} credited`.

The card path opens PayPal's hosted card fields (card number, expiry, CSC,
billing address, mobile, email) — PCI stays with PayPal, no card data touches
your servers.

---

## 6. Errors

| Case | Handling |
| --- | --- |
| Missing client id / secret | `configured:false` → show “PayPal isn’t configured yet.” |
| SDK blocked | “PayPal SDK failed to load — check ad blockers” |
| Funding not eligible | Hide button, show region/device message |
| Order not `APPROVED` | Return `paid:false`, do not credit |
| Duplicate capture | `alreadyCredited:true`, balance unchanged |
| `custom_id` mismatch | Throw, never credit |

## 7. Checklist

- [ ] Live app created in PayPal Developer; client id + secret in server secrets
- [ ] `enable-funding=card`; Venmo / Pay Later disabled
- [ ] Amount clamped 1–10 000 USD on the server
- [ ] `custom_id` = user id, `PayPal-Request-Id` = order ref
- [ ] `tx_hash = paypal:{orderId}` unique index for idempotency
- [ ] Capture happens server-side only
