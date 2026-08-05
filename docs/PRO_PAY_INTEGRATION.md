# OpenPay Pro Pay — Merchant & Partner Integration

**Audience:** third-party apps (including OpenPay) that want users to pay with **OpenPay Pro payment methods**, with earnings credited to a merchant **OpenPay Pro username** and/or **wallet address**.

Live page: [https://openpaypro.space/docs/pro-pay](https://openpaypro.space/docs/pro-pay)  
Raw markdown: [https://openpaypro.space/api/public/docs/pro-pay](https://openpaypro.space/api/public/docs/pro-pay)

| Resource | URL |
| --- | --- |
| Partner keys portal | https://openpy.space/partner-api |
| Partner Transfer API | `https://araojncyittkahvvpdrn.supabase.co/functions/v1/partner-transfer-api` |
| Pro inbound credit | `POST https://openpaypro.space/api/public/openpay/inbound` |
| Pro developer keys | https://openpaypro.space/developer |
| Pro Top Up UI (buyer) | https://openpaypro.space/topup |
| Pro pay link | https://openpaypro.space/pay/{@user\|0x…} |
| Connect authorize | https://openpy.space/connect |

---

## What you get

1. **Auth** — Connect with OpenPay (OAuth) so buyers can sign in / link identity.  
2. **Checkout** — PayButton charges (OpenPay Balance) via Partner API.  
3. **Pro receive wallet** — Set `@username` and/or `0x` address to receive OUSD.  
4. **Inbound** — Credit that Pro wallet after OpenPay payment (`pro_xfer:`).  
5. **Multi-rail Top Up** — Deep-link buyers into Pro’s Pay-with screen (Pi, MoonPay, Banxa, Helio, Solana Pay, Circle, wallet USDT/USDC/SOL, scan-pay…).  
6. **Dashboard / earnings** — Partner portal balance + Pro wallet / Ledger reconcile.  
7. **Copy-paste** — Env, curl, Node.

> **Important:** The full multi-rail “Pay with” UI (Pi, Banxa, MoonPay, …) runs **inside OpenPay Pro** (`/topup`). Partners do **not** call those provider secrets directly. Use Partner Transfer **charges** for OpenPay Balance checkout, **inbound** to land funds on a Pro merchant wallet, and **deep links** when the buyer needs Pro’s full method list.

---

## Architecture (merchant)

```
Buyer                    Your app / OpenPay              Settlement
─────                    ─────────────────              ──────────
1. Open checkout    →    POST /charges (opk_live_)  →    OpenPay partner wallet
2. Pay OpenPay Bal  →    poll GET /charges/:id      →    status=paid
3. Credit Pro       →    POST …/inbound             →    Pro @merchant / 0x
   (optional)            note: pro_xfer:@merchant:r_

OR deep-link buyer → https://openpaypro.space/topup  (self-fund Pro wallet)
                 → https://openpaypro.space/pay/@merchant?amount=…
```

---

## Step 0 — Choose receive destination

Merchants set where earnings land:

| Destination | Where to set | Used for |
| --- | --- | --- |
| OpenPay partner owner wallet | Partner portal app owner | Charge proceeds (`GET /balance`) |
| Pro `@username` | Pro Settings / profile | Inbound `to: "@alice"` |
| Pro `0x` wallet address | Pro wallet screen | Inbound `to: "0x…"` |
| Pro developer key `opdk_…` | https://openpaypro.space/developer | Inbound scoped to **your** Pro wallet only |

Save in your dashboard:

```json
{
  "merchant_id": "m_123",
  "pro_username": "@shop",
  "pro_wallet": "0x7bf2…851a",
  "openpay_client_id": "uuid…",
  "receive_mode": "pro_inbound"
}
```

---

## Step 1 — Partner app & env

1. Open https://openpy.space/partner-api → register app.  
2. Copy `client_id` + `opk_live_…` (shown once).  
3. Register exact OAuth redirect URIs if you use Connect.  
4. Server env:

```bash
# Required for Partner Transfer (charges / transfers / inbound with opk_)
OPENPAY_CLIENT_ID="your-client-uuid"
OPENPAY_PARTNER_API_KEY="opk_live_..."
OPENPAY_PARTNER_API_BASE="https://araojncyittkahvvpdrn.supabase.co/functions/v1/partner-transfer-api"

# Optional Connect OAuth
OPENPAY_REDIRECT_URI="https://yourapp.com/openpay/callback"

# Merchant receive (your dashboard settings)
MERCHANT_PRO_USERNAME="@shop"
MERCHANT_PRO_WALLET="0x..."          # optional alternate
PRO_INBOUND_URL="https://openpaypro.space/api/public/openpay/inbound"

# Optional: Pro developer key (inbound to your own Pro wallet only)
OPENPAY_PRO_DEVELOPER_KEY="opdk_..."
```

**Never** put `opk_live_…` or `opdk_…` in the browser / `VITE_` vars.

---

## Step 2 — Auth (Connect with OpenPay)

```
https://openpy.space/connect
  ?client_id={CLIENT_ID}
  &redirect_uri={EXACT_REDIRECT}
  &scope=profile%20balance
  &state={CSRF}
```

Exchange code (server):

```bash
curl -X POST "$OPENPAY_PARTNER_API_BASE/oauth/token" \
  -H "Content-Type: application/json" \
  -d '{
    "grant_type": "authorization_code",
    "code": "opc_...",
    "redirect_uri": "'"$OPENPAY_REDIRECT_URI"'",
    "client_id": "'"$OPENPAY_CLIENT_ID"'",
    "client_secret": "'"$OPENPAY_PARTNER_API_KEY"'"
  }'
```

→ `{ access_token: "opa_live_...", expires_in: 2592000, … }`

```bash
curl -H "Authorization: Bearer opa_live_..." \
  "$OPENPAY_PARTNER_API_BASE/user/me"
```

Pro sign-in methods (product): OpenPay, Telegram, Solana, Pi, Phantom, WalletConnect, MetaMask — see `/docs/auth`.

---

## Step 3 — Create checkout (Partner API)

### A · PayButton charge (recommended HTTP)

```bash
curl -X POST "$OPENPAY_PARTNER_API_BASE/charges" \
  -H "Authorization: Bearer $OPENPAY_PARTNER_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 250.00,
    "currency": "OUSD",
    "description": "Order #9001",
    "reference": "order_9001",
    "success_url": "https://yourapp.com/pay/thanks?ref=order_9001",
    "cancel_url": "https://yourapp.com/pay/cancel?ref=order_9001"
  }'
```

Returns `{ id, amount, currency, status, checkout_url, expires_at }` (TTL **~2 hours**).

Redirect buyer to `checkout_url` (or `https://openpy.space/paybutton/{id}`).

**Poll until paid** (no partner webhooks yet):

```bash
curl -H "Authorization: Bearer $OPENPAY_PARTNER_API_KEY" \
  "$OPENPAY_PARTNER_API_BASE/charges/{CHARGE_ID}"
# status: created | paid | canceled | expired
```

Earnings land on the **partner-app owner’s OpenPay balance** → `GET /me` / `GET /balance`.

### B · Credit merchant’s OpenPay Pro wallet (inbound)

After charge is `paid` (or after OpenPay pay-link success), credit Pro:

```bash
curl -X POST "https://openpaypro.space/api/public/openpay/inbound" \
  -H "Authorization: Bearer $OPENPAY_PARTNER_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "to": "@shop",
    "amount": 250.00,
    "openpay_tx_id": "UNIQUE_OPENPAY_OR_CHARGE_ID",
    "note": "pro_xfer:@shop:r_order_9001",
    "from_username": "buyer"
  }'
```

- `to`: `@username` · `0x` address · or `uid_<uuid>`  
- Idempotent on `openpay_tx_id`  
- `opdk_…` only credits the key owner’s Pro wallet

### C · Deep-link Pro Pay-with methods (full rails)

When the buyer should use Pro’s Top Up screen (Pi, Banxa, MoonPay, wallet majors, …):

```
https://openpaypro.space/topup
```

Then pay the merchant:

```
https://openpaypro.space/pay/@shop?amount=250&asset=OUSD&note=order_9001
```

Or share a **Receive → Create OpenPay receive link** from Pro (embeds `pro_xfer:` automatically).

---

## OpenPay Pro payment methods (product catalog)

These appear on Pro `/topup` “Pay with”. Partners **deep-link**; they do not call provider APIs with Pro secrets.

| Method key | Label | Notes |
| --- | --- | --- |
| `pi` | Pi Network (π) | Live π price → OUSD |
| `openpay_balance` | OpenPay Balance | Connected OpenPay debit |
| `moonpay` | MoonPay | Card / Apple Pay / Google Pay |
| `banxa_apple_pay` | Apple Pay | Banxa hosted |
| `banxa_google_pay` | Google Pay | Banxa hosted |
| `banxa_card` | Card | Banxa hosted |
| `banxa_bank` | Bank Transfer | Banxa hosted |
| `usdc` | USDC Pay | MoonPay Commerce |
| `helio` | Crypto Deposit | SOL / crypto |
| `solana_pay` | Solana Pay | QR / Commerce Kit |
| `circle_mint` | Circle Deposit | USDC mint payin |
| `cash_pay` | Pay with CASH | Phantom CASH → OUSD |
| `scan_pay` | Scan to pay | Multi-chain QR verify |
| `wallet_usdt` | Wallet USDT | Pro USDT → OUSD 1:1 |
| `wallet_usdc` | Wallet USDC | Pro USDC → OUSD 1:1 |
| `wallet_sol` | Wallet SOL | Live SOL price → OUSD |

Admin can disable methods under Pro `/admin/topup`.

---

## Step 4 — Dashboard & earnings

| Surface | What merchants see |
| --- | --- |
| Partner portal | App keys, redirects, owner OpenPay balance |
| `GET /me` + `GET /balance` | Server earnings on OpenPay (after charges) |
| Pro `/dashboard` / wallet | OUSD (and majors) after inbound / receives |
| Pro `/developer` | Create/rotate `opdk_…` |
| Pro `/activity` | Transaction history |
| Ledger API | Reconcile `buy` / `receive` / `send` |

Minimal earnings poller:

```js
async function partnerBalance(api, key) {
  const res = await fetch(`${api}/balance`, {
    headers: { Authorization: `Bearer ${key}` },
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}
```

---

## Step 5 — Minimal Node (copy-paste)

```js
const API =
  process.env.OPENPAY_PARTNER_API_BASE ||
  "https://araojncyittkahvvpdrn.supabase.co/functions/v1/partner-transfer-api";
const KEY = process.env.OPENPAY_PARTNER_API_KEY;
const INBOUND =
  process.env.PRO_INBOUND_URL ||
  "https://openpaypro.space/api/public/openpay/inbound";
const MERCHANT = process.env.MERCHANT_PRO_USERNAME || "@shop";

export async function createCheckout({ amount, reference, success_url, cancel_url }) {
  const res = await fetch(`${API}/charges`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      amount,
      currency: "OUSD",
      description: reference,
      reference,
      success_url,
      cancel_url,
    }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json(); // { id, checkout_url, status }
}

export async function waitUntilPaid(chargeId, { intervalMs = 2000, maxMs = 120000 } = {}) {
  const start = Date.now();
  while (Date.now() - start < maxMs) {
    const res = await fetch(`${API}/charges/${chargeId}`, {
      headers: { Authorization: `Bearer ${KEY}` },
    });
    const data = await res.json();
    if (data.status === "paid") return data;
    if (data.status === "canceled" || data.status === "expired") {
      throw new Error(`Charge ${data.status}`);
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  throw new Error("Charge poll timeout");
}

export async function creditMerchantPro({ amount, openpay_tx_id, reference, from_username }) {
  const res = await fetch(INBOUND, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      to: MERCHANT,
      amount,
      openpay_tx_id,
      note: `pro_xfer:${MERCHANT}:r_${reference}`,
      from_username,
    }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

/** Full path: charge → poll → credit Pro receive wallet */
export async function checkoutAndSettle(order) {
  const charge = await createCheckout(order);
  // redirect user to charge.checkout_url, then on return:
  const paid = await waitUntilPaid(charge.id);
  await creditMerchantPro({
    amount: paid.amount,
    openpay_tx_id: paid.id,
    reference: order.reference,
  });
  return paid;
}
```

---

## Keys cheat sheet

| Key | Prefix | Use |
| --- | --- | --- |
| Partner API key | `opk_live_…` | Charges, transfers, inbound (master) |
| User Connect token | `opa_live_…` | `/user/me`, `/user/balance` |
| Pro developer key | `opdk_…` | Inbound to **own** Pro wallet only |
| Ledger key | issued / master | Public Ledger reconcile |

---

## Errors & rules

| Status | Meaning |
| --- | --- |
| 401 | Bad / revoked key |
| 403 | Origin / redirect not allowlisted |
| 404 | Account / charge missing |
| 400 | Validation / insufficient balance |

1. Server-only secrets.  
2. Exact-match OAuth redirect URIs.  
3. Poll charges — no partner payment webhooks.  
4. Idempotency on transfers + inbound `openpay_tx_id`.  
5. OUSD is a ledger asset (not a public EVM/SPL contract).

---

## Launch checklist

- [ ] Partner app created; `opk_live_…` + `client_id` in server secrets  
- [ ] Merchant Pro `@username` and/or `0x` saved in your dashboard  
- [ ] Optional Connect OAuth redirect allowlisted  
- [ ] Create charge → redirect → poll `paid`  
- [ ] Inbound credits Pro receive wallet (if using Path B)  
- [ ] Deep-link `/topup` + `/pay/@merchant` tested (if using Path C)  
- [ ] Earnings visible via `GET /balance` and/or Pro wallet  

---

## Related

- Connect & payments: `/docs/openpay`  
- Partner Transfer API: `/docs/api`  
- Auth methods: `/docs/auth`  
- AI Partner Pack: `/docs/ai`  
- **OpenPay QR Pay → Pro (paste into OpenPay):** [`OPENPAY_QRPAY_PRO.md`](./OPENPAY_QRPAY_PRO.md) · raw [`/api/public/docs/qrpay-pro`](/api/public/docs/qrpay-pro)  
- Inbound detail: `/api/public/docs/openpay-to-pro`  
